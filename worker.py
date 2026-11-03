from app import app
from workers import wsgi

Default = wsgi.entrypoint(app)
