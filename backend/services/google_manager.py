from aiogoogle import Aiogoogle
from aiogoogle.auth.creds import ClientCreds, ServiceAccountCreds
from aiogoogle.auth.managers import Oauth2Manager
from aiogoogle.excs import HTTPError
from celery.utils.log import get_task_logger
from django.conf import settings

from .threadsafe_manager import ThreadsafeManager

logger = get_task_logger(__name__)

scopes = [
    "https://www.googleapis.com/auth/drive",
]


class GoogleManager(ThreadsafeManager):
    def __init__(self, loop):
        super().__init__(loop)

        self.service_account_creds = ServiceAccountCreds(
            scopes=scopes,
            **settings.DRIVE_SETTINGS["credentials"],
        )
        self.oauth_client_creds = ClientCreds(
            client_id=settings.DRIVE_SETTINGS["oauth"]["client_id"],
            client_secret=settings.DRIVE_SETTINGS["oauth"]["secret"],
        )
        self.template_id = settings.DRIVE_SETTINGS["template_id"]
        self.puzzle_folder_id = settings.DRIVE_SETTINGS["puzzle_folder_id"]
        self.client = Aiogoogle(service_account_creds=self.service_account_creds)
        self.oauth_client = Oauth2Manager(client_creds=self.oauth_client_creds)

        self.drive = None
        self.sheets = None

    async def setup(self):
        if self.drive is None:
            self.sheets = await self.client.discover("sheets", "v4")
            self.drive = await self.client.discover("drive", "v3")

    async def check_access(self, user):
        await self.setup()

        async def get_capability(file_id, capability):
            resp = await self.client.as_user(
                self.drive.files.get(
                    fileId=file_id,
                    fields=f"capabilities/{capability}",
                ),
                user_creds=user.user_creds,
            )
            return resp["capabilities"][capability]

        try:
            return all(
                (
                    await get_capability(self.puzzle_folder_id, "canAddChildren"),
                    await get_capability(self.template_id, "canCopy"),
                )
            )
        except HTTPError as e:
            logger.error(f"User Access Error: {repr(e)}")
            return False

    @classmethod
    def sync_check_access(cls, user):
        return cls._run_sync_threadsafe(cls.check_access, user)

    async def create(self, name, owner):
        await self.setup()
        updated_user_creds = None
        copy_request = self.drive.files.copy(
            fileId=self.template_id,
            json={
                "name": name,
                "parents": [self.puzzle_folder_id],
            },
        )
        try:
            if owner is None:
                raise RuntimeError("No one has been authenticated as a sheets owner")
            _, updated_user_creds = await self.oauth_client.refresh(owner.user_creds)
            sheet_file = await self.client.as_user(
                copy_request,
                user_creds=updated_user_creds,
            )
        except Exception as e:
            logger.error(f"Sheets Owner Error: {repr(e)}")
            sheet_file = await self.client.as_service_account(copy_request)
        sheet_id = sheet_file["id"]
        return {
            "sheet_id": sheet_id,
            "updated_user_creds": updated_user_creds,
        }

    async def add_links(self, sheet_id, checkmate_link=None, puzzle_link=None):
        if not checkmate_link or not puzzle_link:
            return
        await self.setup()
        await self.client.as_service_account(
            self.sheets.spreadsheets.values.update(
                spreadsheetId=sheet_id,
                range="A1:B1",
                valueInputOption="USER_ENTERED",
                json={
                    "values": [
                        [
                            f'=HYPERLINK("{checkmate_link}", "Checkmate Link")'
                            if checkmate_link
                            else None,
                            f'=HYPERLINK("{puzzle_link}", "Puzzle Link")'
                            if puzzle_link
                            else None,
                        ]
                    ],
                },
            ),
        )

    async def rename(self, file_id, name):
        await self.setup()
        await self.client.as_service_account(
            self.drive.files.update(
                fileId=file_id,
                json={
                    "name": name,
                },
            )
        )
