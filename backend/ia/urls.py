from django.urls import path

from .views import IAStatusView, IATestarView

urlpatterns = [
    path('admin/ia/status/', IAStatusView.as_view(), name='ia-status'),
    path('admin/ia/testar/', IATestarView.as_view(), name='ia-testar'),
]
