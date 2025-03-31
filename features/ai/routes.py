
from flask import request, jsonify, current_app
import os
from features.ai.providers import AIProvider


def register_ai_integration_routes(app):
    """
    Register routes related to AI model integration.

    Args:
        app: Flask application instance
    """

    @app.route('/api/get_ai_response', methods=['POST'])
    def get_ai_response():
        """
        Process a user's prompt and return an AI response.

        Expected request format:
        {
            "prompt": "User's prompt text here",
            "provider": "openai" | "anthropic" | "gemini" | "ollama" | "deepseek" | "xai" | "mistral",
            "reasoning_effort": "low" | "medium" | "high" (optional, default is "medium")
        }

        Returns:
            JSON response containing AI's reply and token usage information
        """
        try:
            # Extract request data
            data = request.get_json()

            if not data:
                return jsonify({"error": "No data provided"}), 400

            prompt = data.get('prompt')
            # Default to Anthropic if not specified
            provider = data.get('provider', 'anthropic')
            reasoning_effort = data.get('reasoning_effort', 'medium')

            if not prompt:
                return jsonify({"error": "No prompt provided"}), 400

            # Validate provider
            valid_providers = ["openai", "anthropic",
                               "gemini", "ollama", "deepseek", "xai", "mistral"]
            if provider not in valid_providers:
                return jsonify({"error": f"Invalid provider. Must be one of: {', '.join(valid_providers)}"}), 400

            # Validate reasoning effort
            valid_efforts = ["low", "medium", "high"]
            if reasoning_effort not in valid_efforts:
                return jsonify({"error": f"Invalid reasoning effort. Must be one of: {', '.join(valid_efforts)}"}), 400

            # Initialize the AI provider
            ai_provider = AIProvider(provider)

            # Set reasoning effort
            ai_provider.set_reasoning_effort(reasoning_effort)

            # Process the prompt and get response
            print(
                f"Processing prompt with {provider} provider, reasoning effort: {reasoning_effort}")
            print(f"Prompt content: {prompt[:100]}..." if len(
                prompt) > 100 else prompt)

            response_data = ai_provider.prompt(prompt)

            # Format the response
            result = {
                "text": response_data["text"],
                "input_tokens": response_data.get("input_tokens", 0),
                "output_tokens": response_data.get("output_tokens", 0),
                "time_taken": response_data.get("time_taken", 0),
                "provider": provider
            }

            return jsonify(result)

        except Exception as e:
            error_message = f"Error getting AI response: {str(e)}"
            print(error_message)
            return jsonify({"error": error_message}), 500

    @app.route('/api/get_available_models', methods=['GET'])
    def get_available_models():
        """
        Return a list of available AI models and providers.

        Returns:
            JSON response containing available AI models
        """
        try:
            # These are the models defined in ai_provider.py
            available_models = {
                "openai": {
                    "model": "o3-mini",
                    "description": "Latest OpenAI model with reasoning capabilities"
                },
                "anthropic": {
                    "model": "claude-3-7-sonnet-20250219",
                    "description": "Claude 3.7 Sonnet model"
                },
                "gemini": {
                    "model": "gemini-2.5-pro-exp-03-25",
                    "description": "Google's latest Gemini model"
                },
                "ollama": {
                    "model": "llama3",
                    "description": "Local Llama 3 model via Ollama"
                },
                "deepseek": {
                    "model": "deepseek-reasoner",
                    "description": "Deepseek's reasoning-focused model"
                },
                "xai": {
                    "model": "grok-2-latest",
                    "description": "xAI's Grok 2 model"
                },
                "mistral": {
                    "model": "mistral-large-latest",
                    "description": "Mistral's latest large model"
                }
            }

            return jsonify({
                "available_models": available_models,
                "default_provider": "anthropic",
                "default_reasoning_effort": "medium"
            })

        except Exception as e:
            error_message = f"Error getting available models: {str(e)}"
            print(error_message)
            return jsonify({"error": error_message}), 500
