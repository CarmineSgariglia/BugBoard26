from django.db import migrations, transaction


def normalize_tag_names(apps, schema_editor):
    Tag = apps.get_model("bugboardapi", "Tag")
    IssueTag = apps.get_model("bugboardapi", "IssueTag")

    grouped_tags: dict[str, list] = {}
    for tag in Tag.objects.all().order_by("tag_id"):
        normalized = (tag.name or "").strip().lower()
        grouped_tags.setdefault(normalized, []).append(tag)

    for normalized_name, tags in grouped_tags.items():
        if not normalized_name:
            continue

        canonical = tags[0]
        duplicates = tags[1:]

        with transaction.atomic():
            for duplicate in duplicates:
                issue_ids = IssueTag.objects.filter(tag_id=duplicate.tag_id).values_list("issue_id", flat=True)
                for issue_id in issue_ids:
                    IssueTag.objects.get_or_create(issue_id=issue_id, tag_id=canonical.tag_id)
                IssueTag.objects.filter(tag_id=duplicate.tag_id).delete()
                duplicate.delete()

            if canonical.name != normalized_name:
                canonical.name = normalized_name
                canonical.save(update_fields=["name"])


class Migration(migrations.Migration):

    dependencies = [
        ("bugboardapi", "0011_alter_passwordresetotp_code"),
    ]

    operations = [
        migrations.RunPython(normalize_tag_names, migrations.RunPython.noop),
    ]
