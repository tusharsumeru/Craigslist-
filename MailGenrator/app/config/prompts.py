import yaml
import os

PROMPTS_PATH = os.path.join(os.path.dirname(__file__), 'config.yaml')

def get_prompt_by_persona(persona):
    with open(PROMPTS_PATH, 'r') as file:
        all_prompts = yaml.safe_load(file)
        return all_prompts.get(persona)
