import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('matches', '0001_initial'),
        ('perfis', '0004_perfil_novos_campos'),
    ]

    operations = [
        migrations.CreateModel(
            name='Mensagem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('conteudo', models.TextField()),
                ('data_envio', models.DateTimeField(auto_now_add=True)),
                ('lida', models.BooleanField(default=False)),
                ('match', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='mensagens',
                    to='matches.match',
                )),
                ('remetente', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    to='perfis.perfil',
                )),
            ],
            options={
                'ordering': ['data_envio', 'id'],
            },
        ),
        migrations.AddIndex(
            model_name='mensagem',
            index=models.Index(fields=['match', 'data_envio'], name='chat_mensag_match_i_idx'),
        ),
    ]
