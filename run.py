from pathlib import Path
from app import create_app
import webbrowser
import threading
import os
import sys

# Get the current directory from the argument passed by the .bat file
if len(sys.argv) > 1:
    current_dir = Path(sys.argv[1])
else:
    # Fallback if no argument is passed (optional)
    current_dir = Path(__file__).resolve().parent

app = create_app(str(current_dir))


def open_browser():
    webbrowser.open_new('http://127.0.0.1:5000')


if __name__ == '__main__':
    if os.environ.get('WERKZEUG_RUN_MAIN') is None:
        threading.Timer(1, open_browser).start()

    app.run(debug=True)
