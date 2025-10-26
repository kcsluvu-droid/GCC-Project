import pandas as pd
import pathlib
import sys
import datetime # Import for generating the timestamp
import os       # Import for renaming the file (pathlib.Path.rename() can also be used)

# --- Configuration ---
OUTPUT_FILE_NAME = 'db.json'
OUTPUT_SHEET_NAME = 'Base Data' # Keep this consistent with the existing logic

# --- Check for command-line argument and set file name ---

if len(sys.argv) < 2:
    print("Error: Please provide the Excel file name as a command-line argument.")
    print("Usage: python import_data.py <excel_file_name.xlsx>")
    sys.exit(1)

data_file_name = sys.argv[1]

# --- File Path Construction ---

home_dir = pathlib.Path.home()
downloads_dir = home_dir / "Downloads"
file_to_open = downloads_dir / data_file_name
output_file_path = pathlib.Path(OUTPUT_FILE_NAME)

# -----------------------------------------------------------
# NEW LOGIC: Check for existing output file and rename it
# -----------------------------------------------------------
if output_file_path.exists():
    # 1. Generate a timestamp string (e.g., _20251013_102500)
    timestamp = datetime.datetime.now().strftime("_%Y%m%d_%H%M%S")
    
    # 2. Define the new file name (e.g., db_20251013_102500.json)
    # Use the stem (db) and suffix (.json) of the original name
    archive_file_name = f"{output_file_path.stem}{timestamp}{output_file_path.suffix}"
    archive_file_path = pathlib.Path(archive_file_name)

    # 3. Rename the existing file
    try:
        output_file_path.rename(archive_file_path)
        print(f"Existing file renamed to: {archive_file_name}")
    except OSError as e:
        print(f"Error renaming existing file {OUTPUT_FILE_NAME}: {e}")
        sys.exit(1)


# --- Data Processing (No changes here) ---

try:
    # 1. Read the Excel file.
    df = pd.read_excel(file_to_open, sheet_name=OUTPUT_SHEET_NAME)
    
except FileNotFoundError:
    print(f"Error: The file '{file_to_open}' was not found.")
    sys.exit(1)
except ValueError as e:
    print(f"Error reading Excel file: {e}")
    sys.exit(1)
except Exception as e:
    print(f"An unexpected error occurred: {e}")
    sys.exit(1)


# 2. Convert the DataFrame to JSON format
json_data = df.to_json(orient='records', indent=4)

# 3. Write the JSON data to the new 'db.json' file
with open(OUTPUT_FILE_NAME, 'w') as f:
    f.write(json_data)

print(f"Conversion complete. Data from '{data_file_name}' saved to {OUTPUT_FILE_NAME}")