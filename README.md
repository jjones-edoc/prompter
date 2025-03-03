# Prompter

Prompter is a simple web application that helps you create prompts for Claude by browsing your file system, selecting files (even from subfolders), and combining their contents with a custom prompt.

## Features

- Browse directories and files in a user-friendly interface
- Navigate through subfolders
- Select individual files or entire folders
- Respects `.gitignore` rules and ignores hidden files/folders
- Generate prompts with file contents embedded in them
- Easy copy-to-clipboard functionality

## Installation

1. Clone this repository:

   ```
   git clone <repository-url>
   cd prompter
   ```

2. Install the required dependencies:

   ```
   pip install -r requirements.txt
   ```

3. Create a static folder and CSS file:

   ```
   mkdir -p static/css
   touch static/css/style.css
   ```

4. Copy the CSS content from the provided `style.css` into this file.

## Usage

1. Run the application:

   ```
   python app.py
   ```

2. Open your browser and go to `http://127.0.0.1:5000`

3. You'll see a file browser interface where you can:

   - Navigate through folders
   - Select individual files by checking the boxes next to them
   - Select all files in a folder by checking the box next to the folder
   - Use the "Select All" checkbox to select all files in the current directory

4. After selecting files, click "Next" to proceed to the prompt input screen

5. Enter your custom prompt text and click "Generate"

6. On the final screen, you can:
   - Copy the generated prompt to your clipboard
   - Open Claude directly
   - Start a new prompt

## File Structure

- `app.py`: Main Flask application
- `filesystem.py`: File system handler with .gitignore support
- `templates/`: HTML templates
  - `index.html`: File browser
  - `prompt.html`: Prompt input
  - `generated.html`: Generated prompt
- `static/css/style.css`: CSS styles
- `static/js/script.js`: JavaScript for the UI

## How It Works

1. The application scans your current directory, respecting `.gitignore` rules and ignoring hidden files
2. When you select files or folders, the paths are collected
3. For selected folders, all files within them (including in subfolders) are collected recursively
4. The application reads the contents of all selected files
5. Your custom prompt is combined with the file contents using the format: `<file path="path/to/file">file content</file>`
6. The combined prompt is displayed and can be copied to your clipboard for use with Claude

## Requirements

- Python 3.6+
- Flask
- pathspec (for .gitignore support)
