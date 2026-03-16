from django.db import migrations


EMAIL_CASE_INSENSITIVE_INDEX_NAME = "auth_user_email_ci_unique_idx"


def assert_no_case_insensitive_email_duplicates(apps, schema_editor):
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                LOWER(email) AS normalized_email,
                COUNT(*) AS duplicate_count,
                ARRAY_AGG(id ORDER BY id) AS user_ids,
                ARRAY_AGG(email ORDER BY id) AS raw_emails
            FROM auth_user
            WHERE email <> ''
            GROUP BY LOWER(email)
            HAVING COUNT(*) > 1
            ORDER BY LOWER(email)
            """
        )
        duplicates = cursor.fetchall()

    if not duplicates:
        return

    details = []
    for normalized_email, duplicate_count, user_ids, raw_emails in duplicates:
        details.append(
            f"{normalized_email}: count={duplicate_count}, user_ids={user_ids}, emails={raw_emails}"
        )

    raise RuntimeError(
        "Cannot enforce case-insensitive email uniqueness until duplicate auth_user.email values "
        "are resolved manually. Conflicts found:\n" + "\n".join(details)
    )


class Migration(migrations.Migration):
    dependencies = [
        ("bugboardapi", "0025_notifyuser_stream_index"),
    ]

    operations = [
        migrations.RunPython(
            assert_no_case_insensitive_email_duplicates,
            migrations.RunPython.noop,
        ),
        migrations.RunSQL(
            sql=f"""
            CREATE UNIQUE INDEX {EMAIL_CASE_INSENSITIVE_INDEX_NAME}
            ON auth_user (LOWER(email))
            WHERE email <> '';
            """,
            reverse_sql=f"DROP INDEX IF EXISTS {EMAIL_CASE_INSENSITIVE_INDEX_NAME};",
        ),
    ]
