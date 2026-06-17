# ai-service/check_data.py
import pandas as pd
import os

data_path = "data"

# Tìm file CSV hoặc JSON
for file in os.listdir(data_path):
    if file.endswith('.csv'):
        print(f"Found CSV: {file}")
        df = pd.read_csv(os.path.join(data_path, file))
        print(f"Shape: {df.shape}")
        print(f"Columns: {df.columns.tolist()}")
        print("\nFirst 2 rows:")
        print(df.head(2))
        break
    elif file.endswith('.json'):
        print(f"Found JSON: {file}")
        df = pd.read_json(os.path.join(data_path, file))
        print(f"Shape: {df.shape}")
        print(f"Columns: {df.columns.tolist()}")
        print("\nFirst 2 rows:")
        print(df.head(2))
        break