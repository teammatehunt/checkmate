from aiogoogle import Aiogoogle
from aiogoogle.auth.creds import ServiceAccountCreds
from django.conf import settings

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
        self.owner_id = str(settings.DRIVE_SETTINGS['owner_id'])
        self.client = Aiogoogle(service_account_creds=self.creds)

        self.drive = None
        self.sheets = None

    async def setup(self):
        if self.drive is None:
            self.drive = await self.client.discover('drive', 'v3')
            self.sheets = await self.client.discover('sheets', 'v4')
            await self.client._ensure_session_set()

    async def create(self, name):
        await self.setup()
        sheet_file = await self.client.as_service_account(
            self.drive.files.copy(
                fileId=self.template_id,
                json={
                    'name': name,
                    'parents': [self.puzzle_folder_id],
                },
            ),
        )
        sheet_id = sheet_file['id']
        await self.client.as_service_account(
            self.drive.permissions.update(
                fileId=sheet_id,
                permissionId=self.owner_id,
                transferOwnership=True,
                json={
                    'role': 'owner',
                },
            ),
        )
        return sheet_id

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
