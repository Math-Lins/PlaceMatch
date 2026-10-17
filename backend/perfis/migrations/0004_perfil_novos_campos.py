import django.core.validators
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('perfis', '0003_alter_perfil_nivel_organizacao_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='perfil',
            name='perfil_horario',
            field=models.CharField(
                choices=[
                    ('madrugador', 'Madrugador (acorda cedo)'),
                    ('noturno', 'Noturno (dorme/acorda tarde)'),
                    ('flexivel', 'Flexível'),
                ],
                default='flexivel',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='perfil',
            name='nivel_ruido',
            field=models.IntegerField(
                default=3,
                validators=[
                    django.core.validators.MinValueValidator(1),
                    django.core.validators.MaxValueValidator(5),
                ],
            ),
        ),
        migrations.AddField(
            model_name='perfil',
            name='nivel_social',
            field=models.IntegerField(
                default=3,
                validators=[
                    django.core.validators.MinValueValidator(1),
                    django.core.validators.MaxValueValidator(5),
                ],
            ),
        ),
        migrations.AddField(
            model_name='perfil',
            name='aceita_visitas',
            field=models.CharField(
                choices=[
                    ('raramente', 'Raramente'),
                    ('as_vezes', 'Às vezes'),
                    ('frequentemente', 'Frequentemente'),
                ],
                default='as_vezes',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='perfil',
            name='tipo_imovel',
            field=models.CharField(
                choices=[
                    ('apartamento', 'Apartamento'),
                    ('casa', 'Casa'),
                    ('republica', 'República'),
                    ('indiferente', 'Indiferente'),
                ],
                default='indiferente',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='perfil',
            name='qtd_moradores',
            field=models.IntegerField(
                default=2,
                validators=[
                    django.core.validators.MinValueValidator(1),
                    django.core.validators.MaxValueValidator(4),
                ],
            ),
        ),
    ]
