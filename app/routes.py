# ./app/routes.py

from flask import Blueprint, render_template
from .db import get_preference, get_selected_files

main_bp = Blueprint('main', __name__)


@main_bp.route('/')
def index():
    last_path = get_preference('last_path') or '/'
    selected_files = get_selected_files()
    return render_template('index.html', last_path=last_path, selected_files=selected_files)


@main_bp.route('/builder')
def builder():
    return render_template('builder.html')
