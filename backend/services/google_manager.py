from aiogoogle import Aiogoogle
from aiogoogle.auth.creds import ServiceAccountCreds
from aiogoogle.excs import HTTPError
from celery.utils.log import get_task_logger
from django.conf import settings

logger = get_task_logger(__name__)

scopes = [
    'https://www.googleapis.com/auth/drive',
]

class GoogleManager:
    __instance = None

    @classmethod
    def instance(cls):
        '''
        Get a single instance per process.
        '''
        if cls.__instance is None:
            cls.__instance = cls()
        return cls.__instance

    def __init__(self):
        self.creds = ServiceAccountCreds(
            scopes=scopes,
            **settings.DRIVE_SETTINGS['credentials'],
        )
        self.template_id = settings.DRIVE_SETTINGS['template_id']
        self.puzzle_folder_id = settings.DRIVE_SETTINGS['puzzle_folder_id']
        self.client = Aiogoogle(service_account_creds=self.creds)

        self.drive = None
        self.sheets = None

    async def setup(self):
        if self.drive is None:
            self.sheets = await self.client.discover('sheets', 'v4')
            self.drive = await self.client.discover('drive', 'v3')

    async def check_access(self, user):
        await self.setup()
        try:
            folder_metadata = await self.client.as_user(
                self.drive.files.get(
                    fileId=self.puzzle_folder_id,
                ),
                user_creds=user.user_creds,
            )
            template_metadata = await self.client.as_user(
                self.drive.files.get(
                    fileId=self.template_id,
                ),
                user_creds=user.user_creds,
            )
        except HTTPError as e:
            logger.error(f'User Access Error: {repr(e)}')
            return False
        else:
            return all((
                folder_metadata['capabilities']['canAddChildren'],
                template_metadata['capabilities']['canCopy'],
            ))

    @classmethod
    def sync_check_access(cls, user):
        gmgr = cls.instance()
        return asyncio.get_event_loop().run_until_complete(gmgr.check_access(user))

    async def create(self, name, owner):
        await self.setup()
        new_user_creds = None
        copy_request = self.drive.files.copy(
            fileId=self.template_id,
            json={
                'name': name,
                'parents': [self.puzzle_folder_id],
            },
        )
        try:
            if owner is None:
                raise RuntimeError('No one has been authenticated as a sheets owner')
            sheet_file = await self.client.as_user(
                copy_request,
                user_creds=owner.user_creds,
            )
            new_user_creds = sheet_file.user_creds
        except Exception as e:
            logger.error(f'Sheets Owner Error: {repr(e)}')
            sheet_file = await self.client.as_service_account(
                copy_request,
            )
        sheet_id = sheet_file['id']
        return {
            'sheet_id': sheet_id,
            'new_user_creds': new_user_creds,
        }

    async def add_links(self, sheet_id, checkmate_link=None, puzzle_link=None):
        if not checkmate_link or not puzzle_link:
            return
        await self.setup()
        await self.client.as_service_account(
            self.sheets.spreadsheets.values.update(
                spreadsheetId=sheet_id,
                range='A1:B1',
                valueInputOption='USER_ENTERED',
                json={
                    'values': [[
                        f'=HYPERLINK("{checkmate_link}", "Checkmate Link")' if checkmate_link else None,
                        f'=HYPERLINK("{puzzle_link}", "Puzzle Link")' if puzzle_link else None,
                    ]],
                },
            ),
        )

    async def rename(self, file_id, name):
        await self.setup()
        await self.client.as_service_account(
            self.drive.files.update(
                fileId=file_id,
                json={
                    'name': name,
                },
            )
        )
