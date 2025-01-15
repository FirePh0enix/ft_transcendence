import sys
import json
import random
import string

import django
import base64
import hashlib
import requests
import os

from django.http import JsonResponse, HttpResponse, HttpResponseBadRequest, HttpResponseRedirect, HttpResponseServerError
from django.http.request import HttpRequest
from django.views.decorators.http import require_POST, require_GET
from django.db.models import Q
from django.contrib import messages
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required

from .models import duck, Player, Tournament, PongGameResult, Chat, Message
from .models import duck, Player, Tournament, PongGameResult, Chat, Message
from .errors import *
from .ws import tournaments, pong_manager
from .utils import remove_unwanted_characters
from .views import LoginView
from django.core.mail import send_mail
from django.views.decorators.csrf import csrf_exempt
from .models import OTP

"""
Create a new user.
"""
@csrf_exempt
@require_POST
def signin(request):
    """Inscription + OTP pour vérification"""
    data = json.loads(request.body)

    if "username" not in data or "password" not in data or "nickname" not in data:
        return HttpResponseBadRequest()

    username = data["username"]
    password = data["password"]
    nickname = data["nickname"]

    if remove_unwanted_characters(username) != data["username"]:
        return JsonResponse({"error": INVALID_USERNAME})
    elif remove_unwanted_characters(nickname) != data["nickname"]:
        return JsonResponse({"error": INVALID_NICKNAME})

    if User.objects.filter(username=username).count() > 0:
        return JsonResponse({"error": USERNAME_ALREADY_TAKEN})

    if Player.objects.filter(nickname=nickname).count() > 0:
        return JsonResponse({ "error": NICKNAME_ALREADY_USED })
    if User.objects.filter(username=username).exists():
        return JsonResponse({"error": "Ce nom d'utilisateur est déjà utilisé."}, status=400)

    # Création de l'utilisateur et du joueur
    user = User.objects.create(username=username)
    player = Player.objects.create(user=user, nickname=remove_unwanted_characters(nickname))

    user.set_password(password)
    user.save()

    login(request, user)

    return JsonResponse({})

CLIENT_ID="u-s4t2ud-fd6496bf5631feb3051ccd4d5be873a3e47614223c9ebb635abaefda7d894f92"

def get_valid_login(s: str):
    while Player.objects.filter(nickname=s).count() > 0:
        s += "-"
    return s

"""
Create a new user using 42 API
"""
@require_POST
def signinExternal(request: HttpRequest):
    data = json.loads(request.body)

    if "access_token" in data:
        res = requests.get("https://api.intra.42.fr/v2/me", headers={ "Authorization": "Bearer " + data["access_token"] })

        if res.status_code != 200:
            return JsonResponse({"error": INVALID_TOKEN})
        
        res = res.json()
        user = User.objects.filter(username=res["login"]).first()

        if not user:
            # The access token is valid but the account does not exists, probably due to a database wipe
            return JsonResponse({"error": INVALID_TOKEN})
        
        login(request, user)

        return JsonResponse({ "access_token": data["access_token"] })
    else:
        code = data["code"]
        redirect_uri = data["redirect_uri"]

        # Exchange the code provided by the api for an access token
        res = requests.post("https://api.intra.42.fr/oauth/token", data={"grant_type": "authorization_code", "client_id": CLIENT_ID, "client_secret": os.environ.get("API42_SECRET"), "code": code, "redirect_uri": redirect_uri })

        # print(data, file=sys.stderr)

        if res.status_code != 200:
            print("Bad response from /oauth/token:", res.text, file=sys.stderr)
            return HttpResponseServerError()

        response = res.json()
        access_token = response["access_token"]

        # One last request to query the login, profile picture and other basic info to fill the database
        # https://api.intra.42.fr/v2/me

        res = requests.get("https://api.intra.42.fr/v2/me", headers={ "Authorization": "Bearer " + access_token })
        if res.status_code != 200:
            print("Bad response from /v2/me", file=sys.stderr)
            return HttpResponseServerError()

        res = res.json()
        nickname = get_valid_login(res["login"])

        user = User.objects.filter(username=res["login"]).first()
        if not user:
            user = User.objects.create(username=res["login"])
            player = Player.objects.create(user=user, nickname=nickname, external=True, icon={"external_icon": res["image"]["link"]})

        login(request, user)

        return JsonResponse({ "access_token": access_token })

"""
Log-in
"""
@require_POST
def loginRoute(request: HttpRequest):
    data = json.loads(request.body)

    if not "username" in data or not "password" in data:
        return HttpResponseBadRequest()

    username = data["username"]
    password = data["password"]

    user = authenticate(request, username=username, password=password)
    if user is not None:
        login(request, user)
        return JsonResponse({ })
    else:
        return JsonResponse({ "error": MISMATCH_CREDENTIALS })

"""
Log-in with 42
"""
@require_POST
def loginExternal(request: HttpRequest):
    data = json.loads(request.body)

    if not "access_token" in data:
        return HttpResponseBadRequest()

    access_token = data["access_token"]
    # TODO: Check if the access token is valid

    player = Player.objects.filter(accessToken=access_token, external=True).first()
    user = player.user

    login(request, user)

"""
Logout from an account.
"""
@require_POST
def logoutRoute(request: HttpRequest):
    logout(request)
    return JsonResponse({})

"""
Check if the user is logged in
"""
@require_POST
def isLoggedIn(request: HttpRequest):
    if request.user.is_authenticated:
        return JsonResponse({})
    else:
        return JsonResponse({ "error": NOT_LOGGED_IN })

"""
Update the password
"""
@require_POST
def updatePassword(request: HttpRequest, id):
    if request.user.is_authenticated:
        data = json.loads(request.body)

        oldPassword = data["oldPassword"]
        newPassword = data["newPassword"]

        if oldPassword is None or newPassword is None:
            return HttpResponseBadRequest()

        user = authenticate(username=request.user.username, password=oldPassword)

        # if user is None:
        #     return JsonResponse({ "error": "Invalid password" })

        request.user.set_password(newPassword)
        request.user.save()

        return JsonResponse({})
    else:
        return JsonResponse({ "error": NOT_AUTHENTICATED })

"""
Update a nickname
"""
@require_POST
def updateNickname(request: HttpRequest, id):
    if not request.user.is_authenticated:
        return JsonResponse({ "error": NOT_AUTHENTICATED })

    data = json.loads(request.body)

    player = Player.objects.filter(user=request.user).first()
    if not player:
        return JsonResponse({ "error": INTERNAL_ERROR })

    new_nickname = data["nickname"]

    if remove_unwanted_characters(new_nickname) != new_nickname:
        return JsonResponse({ "error": INVALID_NICKNAME })

    p2 = Player.objects.filter(nickname=new_nickname).first()

    if p2:
        return JsonResponse({ "error": NICKNAME_ALREADY_USED })

    player.nickname = new_nickname
    player.save()

    return JsonResponse({})

@require_POST
def getNickname(request: HttpRequest, id):
    if not request.user.is_authenticated:
        return JsonResponse({ "error": NOT_AUTHENTICATED })

    if id == "c":
        return JsonResponse({ "nickname": Player.objects.filter(user=request.user).first().nickname })
    else:
        p = Player.objects.filter(id=int(id)).first()

        if p is None:
            return JsonResponse({ "error": INVALID_USER_ID })

        return JsonResponse({ "nickname": p.nickname })

"""
"""
@require_POST
def getPlayerProfile(request: HttpRequest, id):
    if not request.user.is_authenticated:
        return JsonResponse({ "error": NOT_AUTHENTICATED })

    data = json.loads(request.body)

    player = Player.objects.filter(user=request.user).first()

    return JsonResponse({
        "nickname": player.nickname,
        "money": player.money,
        "skins": player.skins,
        "pongElo": player.pongElo,
        "id": player.id,
    })

"""
Return the profile picture of a user
"""
def getProfilePicture(request: HttpRequest, id: str):
    if id == "c" and request.user.is_authenticated:
        id = request.user.id
    elif id != "c":
        id = int(id)
    else:
        return HttpResponseBadRequest()

    player = Player.objects.filter(id=id).first()

    if player.icon is None:
        return HttpResponse(duck, "image/svg+xml")

    if player.external:
        return HttpResponseRedirect(player.icon["external_icon"])
    else:
        icon = player.icon
        data = str(icon["data"])
        data = data[data.find(",") + 1:]

        bdata = base64.b64decode(data)

        return HttpResponse(bdata, icon["type"])

"""
Update profile picture
"""
@require_POST
def updateProfilePicture(request: HttpRequest, id):
    if not request.user.is_authenticated:
        return JsonResponse({ "error": NOT_AUTHENTICATED })

    data = json.loads(request.body)
    valid_types = [ "image/svg+xml", "image/png", "image/jpeg", "image/gif" ]

    if data["type"] not in valid_types:
        return JsonResponse({ "error": INVALID_IMAGE_FORMAT })

    # if len(data["image"]) > 250000:
    #     return JsonResponse({ "error": IMAGE_TOO_BIG })

    player = Player.objects.filter(user=request.user).first()
    player.icon = { "type": data["type"], "data": data["image"] }
    player.save()

    return JsonResponse({})

@require_POST
def deleteProfile(request: HttpRequest, id):
    if not request.user.is_authenticated:
        return JsonResponse({ "error": NOT_AUTHENTICATED })

    player = Player.objects.filter(user=request.user).first()
    data = json.loads(request.body)

    if player and player.external:
        if "access_token" in data:
            res = requests.post("https://api.42.fr/oauth/revoke", headers={ "Authorization": "Bearer " + data["access_token"] })
        else:
            return JsonResponse({ "error": INVALID_TOKEN })

    user = request.user
    user.delete()

    return JsonResponse({})

@require_POST
def getPongStats(request: HttpRequest, id):
    if id == "c" and request.user.is_authenticated:
        id = int(Player.objects.filter(user=request.user).first().id)
    else:
        id = int(id)

    player = Player.objects.filter(id=id).first()
    games = PongGameResult.objects.filter(Q(player1=player.id) | Q(player2=player.id))

    return JsonResponse({
        "matches": {
            "1v1local": games.filter(gamemode="1v1local").count(),
            "1v1": games.filter(gamemode="1v1").count(),
            "total": games.count(),
        }
    })

terrainSkins = [ "default-terrain", "brittle-hollow" ]
ballSkins = [ "default-ball" ]

@require_POST
def selectTerrainSkin(request: HttpRequest, id, name):
    if id == "c" and request.user.is_authenticated:
        id = int(Player.objects.filter(user=request.user).first().id)
    else:
        id = int(id)

    if name not in terrainSkins:
        return JsonResponse({ "error": INVALID_SKIN })

    player = Player.objects.filter(id=id).first()
    skins = player.skins

    if "terrain" in skins:
        skins.insert("terrain", name)

    return JsonResponse({})

@require_POST
def selectBallSkin(request: HttpRequest, id, name):
    if id == "c" and request.user.is_authenticated:
        id = int(Player.objects.filter(user=request.user).first().id)
    else:
        id = int(id)

    player = Player.objects.filter(id=id).first()

    if name not in ballSkins:
        return JsonResponse({ "error": INVALID_SKIN })

    player = Player.objects.filter(id=id).first()
    skins = player.skins

    if "ball" in skins:
        skins.insert("ball", name)

    return JsonResponse({})

@require_POST
def getMatches(request: HttpRequest, id):
    if not request.user.is_authenticated:
        return JsonResponse({ "error": NOT_AUTHENTICATED })

    player = Player.objects.filter(id=request.user.id).first()
    results = PongGameResult.objects.filter(Q(player1=player.id) | Q(player2=player.id))

    return JsonResponse({ "results": [{ "gamemode": r.gamemode, "player1": r.player1, "player2": r.player2, "score1": r.score1, "score2": r.score2, "timeStarted": r.timeStarted, "timeEnded": r.timeEnded, "stats": r.stats, "tid": r.tid } for r in results] })

# /api/tournament/create
@require_POST
def tournament_create(request: HttpRequest):
    if not request.user.is_authenticated:
        return JsonResponse({ "error": NOT_AUTHENTICATED })

    data = json.loads(request.body)
    player = Player.objects.filter(user=request.user).first()

    if "gameSettings" not in data or "playerCount" not in data or "openType" not in data or "game" not in data or "fillWithAI" not in data:
        print(data, file=sys.stderr)
        return JsonResponse({ "error": INVALID_REQUEST })

    if data["openType"] not in ["open", "invite"] or data["playerCount"] not in [2, 4, 8]:
        return JsonResponse({ "error": INVALID_REQUEST })

    if remove_unwanted_characters(data["name"]) != data["name"]:
        return JsonResponse({ "error": INVALID_TOURNAMENT_NAME })

    game_settings = data["gameSettings"]
    manager = pong_manager

    tid = tournaments.create(gameManager=pong_manager, host=player.id, name=data["name"], playerCount=data["playerCount"], privacy=data["openType"], password=None, fillWithAI=False, gameSettings=data["gameSettings"])

    return JsonResponse({ "id": tid })

@require_POST
def tournamentInvite(request: HttpRequest, tid):
    if not request.user.is_authenticated:
        return JsonResponse({ "error": NOT_AUTHENTICATED })

    data = json.loads(request.body)
    player = Player.objects.filter(user=request.user).first()\
    
    if not "pid" in data:
        return HttpResponseServerError()

    t = tournaments.tournaments[tid]
    t.invited.append(data["pid"])

def addFriend(request: HttpRequest, friend_id):
    if not request.user.is_authenticated:
        return JsonResponse({"error": NOT_AUTHENTICATED})

    # Récupérer le joueur actuel
    player = Player.objects.filter(user=request.user).first()
    if not player:
        return JsonResponse({"error": INTERNAL_ERROR})

    # Récupérer le joueur ami
    friend = Player.objects.filter(id=friend_id).first()
    if not friend:
        return JsonResponse({"error": FRIEND_NOT_FOUND})

    # Ajouter l'ami
    player.friends.add(friend)

    return JsonResponse({"message": "Friend added successfully."})


@require_POST
def deleteFriend(request: HttpRequest, friend_id):
    if not request.user.is_authenticated:
        return JsonResponse({"error": NOT_AUTHENTICATED})

    # Récupérer le joueur actuel
    player = Player.objects.filter(user=request.user).first()
    if not player:
        return JsonResponse({"error": INTERNAL_ERROR})

    # Récupérer le joueur ami
    friend = Player.objects.filter(id=friend_id).first()
    if not friend:
        return JsonResponse({"error": FRIEND_NOT_FOUND})

    # Supprimer l'ami
    player.friends.remove(friend)

    return JsonResponse({"message": "Friend removed successfully."})


def sendMessage(request: HttpRequest, id, contenu: string):
     if not request.user.is_authenticated:
        return JsonResponse({ "error": NOT_AUTHENTICATED })
     data = json.loads(request.body)
     player = Player.objects.filter(user=request.user).first()
     if not player:
        return JsonResponse({ "error": INTERNAL_ERROR })
     p2 = Player.objects.filter(id=id).first()
     if not p2:
         return JsonResponse({ "error": INTERNAL_ERROR })
     chat, create = Chat.objects.get_or_create(player1=player, player2=p2)
     if not chat:
        return JsonResponse({ "error": INTERNAL_ERROR })
     message = Message.objects.create(content=contenu, sender=player, receiver=p2)
     chat.messages.insert(message)
     return JsonResponse({})

def getMessages(request: HttpRequest, id):
     if not request.user.is_authenticated:
        return JsonResponse({ "error": NOT_AUTHENTICATED })
     data = json.loads(request.body)
     player = Player.objects.filter(user=request.user).first()
     if not player:
        return JsonResponse({ "error": INTERNAL_ERROR })
     p2 = Player.objects.filter(id=id).first()
     if not p2:
         return JsonResponse({ "error": INTERNAL_ERROR })
     chat = Chat.objects.filter(player1 = player, player2=p2)
     if not chat:
        return JsonResponse({ "error": INTERNAL_ERROR })
     messages = chat.messages.all().values("content", "sender", "receiver")
     return JsonResponse({"messages" : list(messages)})

# @require_POST
# def tournament_info(request: HttpRequest, id: str):
#     t = Tournament.objects.filter(tid=id).first()

#     if t is None:
#         return JsonResponse({ "error": TOURNAMENT_DOESNT_EXISTS })

#     return JsonResponse({
#         "game": t.game,
#         "name": t.name,
#         "openType": t.name,
#         "state": t.state,
#     })

def get_users_list(request):
    users = Player.objects.all().values('user_id')
    return JsonResponse(list(users), safe=False)

@csrf_exempt
def get_chat_messages_by_channel_name(request, channel_name):
    if request.method == 'GET':
        try:
            chat = Chat.objects.filter(channel_name=channel_name).first()
            if not chat:
                return JsonResponse({"error": "Chat not found"}, status=404)
            messages = chat.messages.all().order_by('timestamp')
            messages_data = [
                {
                    "content": message.content,
                    "sender": message.sender.user.id,
                    "receiver": message.receiver.user.id,
                    "timestamp": message.timestamp
                }
                for message in messages
            ]
            return JsonResponse({"messages": messages_data}, safe=False)
        except Chat.DoesNotExist:
            return JsonResponse({"error": "Chat not found"}, status=404)
    return JsonResponse({"error": "Invalid request method"}, status=400)

@require_POST
def get_user_id_by_nickname(request: HttpRequest):
    data = json.loads(request.body)
    
    if "nickname" not in data:
        return JsonResponse({"error": "Nickname parameter is required"}, status=400)
    
    nickname = data["nickname"]

    try:
        user = User.objects.get(username=nickname)
        return JsonResponse({"user_id": user.id})
    except User.DoesNotExist:
        return JsonResponse({"error": "User not found"}, status=404)
