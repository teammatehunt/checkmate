# Generated by Django 3.1.3 on 2021-01-14 00:47

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('structure', '0004_auto_20210110_2036'),
    ]

    operations = [
        migrations.AlterField(
            model_name='huntconfig',
            name='discord_server_id',
            field=models.BigIntegerField(blank=True, null=True),
        ),
    ]