"""
URL configuration for users project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from .views import login_view, verify_otp_view

from app import views
from .ws import PongClientConsumer, ChessClientConsumer, TournamentConsumer, PongMatchmakeConsumer, ChatConsumer

urlpatterns = [
    path('admin/', admin.site.urls),

    #2FA
    path('api/login/', login_view, name='login'),
    path('api/verify-otp/', verify_otp_view, name='verify_otp'),

    # Account management
    path('api/signin', views.signin),
    path('api/signin-external', views.signinExternal),
    path('api/login', views.loginRoute),
    path('api/logout', views.logoutRoute),
    path('api/check-logged', views.isLoggedIn),

    path('api/player/<str:id>/password/update', views.updatePassword),
    path('api/player/<str:id>/nickname', views.getNickname),
    path('api/player/<str:id>/nickname/update', views.updateNickname),
    path('api/player/<str:id>/profile', views.getPlayerProfile),
    path('api/player/<str:id>/picture', views.getProfilePicture),
    path('api/player/<str:id>/picture/update', views.updateProfilePicture),
    path('api/player/<str:id>/delete', views.deleteProfile),
    path('api/player/<str:id>/matches', views.getMatches),
    path('api/player/<str:id>/stats/pong', views.getPongStats),

    path('api/player/<str:id>/skins/select-terrain/<str:name>', views.selectTerrainSkin),
    path('api/player/<str:id>/skins/select-ball/<str:name>', views.selectBallSkin),

    path('api/tournament/create', views.tournament_create),
    path('api/tournament/<str:id>/invite', views.tournamentInvite),

    # Chat
    path('api/usersList', views.get_users_list),
    path('api/chat/<str:channel_name>/', views.get_chat_messages_by_channel_name, name='get_chat_messages_by_channel_name'),
    path('api/user-id-by-nickname', views.get_user_id_by_nickname),

]

websocket_urlpatterns = [
    path('ws/pong/<str:id>', PongClientConsumer.as_asgi()),
    path('ws/chess/<str:id>', ChessClientConsumer.as_asgi()),
    path('ws/matchmake/pong', PongMatchmakeConsumer.as_asgi()),
    path('ws/tournament/<str:id>', TournamentConsumer.as_asgi()),
    path('ws/chat/<str:room_name>', ChatConsumer.as_asgi())
]
