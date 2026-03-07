from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
from apps.bugboardapi.models import Project, Issue, IssueType, IssueStatus, Priority

class Command(BaseCommand):
    help = 'Seed 20 sample issues for a given project name.'

    def add_arguments(self, parser):
        parser.add_argument('project_name', type=str, help='Name of the project to seed issues for')
        parser.add_argument('--count', type=int, default=20, help='Number of issues to create')

    def handle(self, *args, **options):
        project_name = options['project_name']
        count = options['count']
        try:
            project = Project.objects.get(name=project_name)
        except Project.DoesNotExist:
            raise CommandError(f'Project "{project_name}" does not exist')
        User = get_user_model()
        # Prefer 'admin' if exists, otherwise first user
        reporter = User.objects.filter(username='admin').first() or User.objects.first()
        if not reporter:
            raise CommandError('No users found to assign as reporter')
        
        for i in range(1, count + 1):
            Issue.objects.create(
                project=project,
                reporter=reporter,
                title=f'Issue {i} - {project_name}',
                description=f'Auto-generated issue {i} for project {project_name}',
                issue_type=IssueType.BUG,
                status=IssueStatus.TODO,
                priority=Priority.MEDIUM,
            )
        self.stdout.write(self.style.SUCCESS(f'Successfully created {count} issues for project "{project_name}"'))
