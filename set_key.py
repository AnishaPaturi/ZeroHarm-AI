import os
import getpass

def main():
    print("ZeroHarm AI - Configure API Key")
    print("-------------------------------")
    key = getpass.getpass("Enter OPENROUTER_API_KEY (typing hidden): ")
    if not key.strip():
        print("Error: Key cannot be empty.")
        return
        
    env_path = os.path.join("backend", ".env")
    if not os.path.exists(env_path):
        print(f"Error: env file not found at {env_path}")
        return
        
    with open(env_path, "r", encoding="utf-8") as f:
        lines = f.readlines()
        
    new_lines = []
    replaced = False
    for line in lines:
        if line.startswith("OPENROUTER_API_KEY="):
            new_lines.append(f"OPENROUTER_API_KEY={key}\n")
            replaced = True
        else:
            new_lines.append(line)
            
    if not replaced:
        new_lines.append(f"\nOPENROUTER_API_KEY={key}\n")
        
    with open(env_path, "w", encoding="utf-8") as f:
        f.writelines(new_lines)
        
    print("API Key updated successfully in backend/.env!")

if __name__ == "__main__":
    main()
