import pandas as pd
import json
import numpy as np
import os

def clean_dataset(file_path):
    print("Leyendo Excel...")
    try:
        # Usamos engine='openpyxl' en caso de que sea necesario, pero pandas infiere si es xlsx.
        df = pd.read_excel(file_path)
    except Exception as e:
        print(f"Error cargando Excel: {e}")
        return
        
    print(f"Total registros originales: {len(df)}")
    
    # 1. Eliminar coordenadas nulas o invalidas
    df = df.dropna(subset=['LATITUD', 'LONGITUD'])
    df['LATITUD'] = pd.to_numeric(df['LATITUD'], errors='coerce')
    df['LONGITUD'] = pd.to_numeric(df['LONGITUD'], errors='coerce')
    df = df.dropna(subset=['LATITUD', 'LONGITUD'])
    
    print(f"Registros con coordenadas válidas: {len(df)}")
    
    # 2. Corrección de codificación (Reemplazo manual para los fallos mas obvios si la terminal o lib arrojó error)
    # Algunos casos comunes vistos en la exploracion "MAZ", "CAF" etc... si ya vienen corruptos desde el excel
    def fix_encoding(text):
        if pd.isna(text): return "Desconocido"
        text = str(text).strip().upper()
        fixes = {
            "MAZ": "MAÍZ",
            "MAIZ": "MAÍZ",
            "CAF": "CAFÉ",
            "CAFE": "CAFÉ",
            "CAA DE AZCAR": "CAÑA DE AZÚCAR",
            "CAÑA DE AZUCAR": "CAÑA DE AZÚCAR",
            "TCNICO": "TÉCNICO",
            "LIMN": "LIMÓN"
        }
        for bad, good in fixes.items():
            if bad in text:
                text = text.replace(bad, good)
        return text

    df['CULTIVO/SISTEMA'] = df['CULTIVO/SISTEMA'].apply(fix_encoding)
    df['MUNICIPIO'] = df['MUNICIPIO'].apply(lambda x: str(x).strip().title() if not pd.isna(x) else "")
    df['ENTIDAD'] = df['ENTIDAD'].apply(lambda x: str(x).strip().title() if not pd.isna(x) else "")
    df['NOMBRE TÉCNICO'] = df.get('NOMBRE TCNICO', df.get('NOMBRE TÉCNICO', pd.Series([""] * len(df))))
    
    if 'NOMBRE TÉCNICO' in df.columns:
        df['NOMBRE TÉCNICO'] = df['NOMBRE TÉCNICO'].apply(lambda x: str(x).strip().title() if not pd.isna(x) else "Sin Asignar")
    
    # 3. Formateo como listado de diccionarios JSON amigable
    records = []
    for _, row in df.iterrows():
        # Vamos a normalizar las llaves a minusculas/camelcase para comodidad de javascript
        records.append({
            "id": int(row['LLAVE']) if pd.notna(row['LLAVE']) else np.random.randint(100000, 999999),
            "estado": row['ENTIDAD'],
            "municipio": row['MUNICIPIO'],
            "lat": float(row['LATITUD']),
            "lng": float(row['LONGITUD']),
            "cultivo": row['CULTIVO/SISTEMA'],
            "tecnico": row['NOMBRE TÉCNICO'] if 'NOMBRE TÉCNICO' in row else "Sin Asignar"
        })
        
    # 4. Asegurarse que el directorio de salida existe
    out_dir = os.path.join(os.path.dirname(__file__), 'public', 'data')
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, 'escuelas.json')
    
    print(f"Exportando {len(records)} registros a JSON...")
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(records, f, ensure_ascii=False, indent=2)
        
    print(f"✅ ¡Listos! Archivo guardado en {out_path}")

if __name__ == "__main__":
    file_path = r"C:\Users\Juan\Dropbox\Proyectos 2026\Escuelas de Campo (Santos)\Escuelas.xlsx"
    clean_dataset(file_path)
