from django.db import migrations, models
from django.contrib.postgres.operations import HStoreExtension

class Migration(migrations.Migration):
    initial = True

    operations = [
        HStoreExtension(),
    ]
