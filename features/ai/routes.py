from flask import request, jsonify, current_app, Response, stream_with_context
import os
import time
import json
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
        Process a user's prompt and return a complete AI response.

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

            # Check if the requested provider has its API key set
            if not is_provider_available(provider):
                return jsonify({"error": f"The {provider} provider is not available. API key is missing."}), 400

            # Validate reasoning effort
            valid_efforts = ["low", "medium", "high"]
            if reasoning_effort not in valid_efforts:
                return jsonify({"error": f"Invalid reasoning effort. Must be one of: {', '.join(valid_efforts)}"}), 400

            # Initialize the AI provider
            ai_provider = AIProvider(provider)

            # Set reasoning effort
            ai_provider.set_reasoning_effort(reasoning_effort)

            # Log processing info
            print(
                f"Processing prompt with {provider} provider, reasoning effort: {reasoning_effort}")
            print(f"Prompt content: {prompt[:100]}..." if len(
                prompt) > 100 else prompt)

            # Get complete response
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

    @app.route('/api/stream_ai_response', methods=['POST'])
    def stream_ai_response():
        """
        Process a user's prompt and stream the AI response in real-time.

        Expected request format:
        {
            "prompt": "User's prompt text here",
            "provider": "openai" | "anthropic" | "gemini" | "ollama" | "deepseek" | "xai" | "mistral",
            "reasoning_effort": "low" | "medium" | "high" (optional, default is "medium")
        }

        Returns:
            Streamed response with text/event-stream content type
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

            # Check if the requested provider has its API key set
            if not is_provider_available(provider):
                return jsonify({"error": f"The {provider} provider is not available. API key is missing."}), 400

            # Validate reasoning effort
            valid_efforts = ["low", "medium", "high"]
            if reasoning_effort not in valid_efforts:
                return jsonify({"error": f"Invalid reasoning effort. Must be one of: {', '.join(valid_efforts)}"}), 400

            # Initialize the AI provider
            ai_provider = AIProvider(provider)

            # Set reasoning effort
            ai_provider.set_reasoning_effort(reasoning_effort)

            # Log processing info
            print(
                f"Streaming prompt with {provider} provider, reasoning effort: {reasoning_effort}")
            print(f"Prompt content: {prompt[:100]}..." if len(
                prompt) > 100 else prompt)

            def generate():
                try:
                    # Create a list with a single message
                    messages = [{"role": "user", "content": prompt}]

                    # Start time for metrics
                    start_time = time.time()
                    total_tokens = 0

                    # Stream the response
                    for chunk in ai_provider.stream_response(messages):
                        # Count tokens in the chunk (approximate)
                        chunk_tokens = len(chunk.split())
                        total_tokens += chunk_tokens

                        # Format as Server-Sent Events
                        yield f"data: {chunk}\n\n"

                    # Calculate elapsed time
                    elapsed_time = time.time() - start_time

                    # Send metrics as a final event
                    metrics = {
                        "output_tokens": total_tokens,
                        "time_taken": elapsed_time,
                        "provider": provider
                    }

                    yield f"event: metrics\ndata: {json.dumps(metrics)}\n\n"

                    # Send a completion event
                    yield "event: done\ndata: \n\n"

                except Exception as e:
                    error_msg = f"Error during streaming: {str(e)}"
                    print(error_msg)
                    yield f"event: error\ndata: {error_msg}\n\n"

            return Response(
                stream_with_context(generate()),
                content_type='text/event-stream'
            )
        except Exception as e:
            error_message = f"Error streaming AI response: {str(e)}"
            print(error_message)
            return jsonify({"error": error_message}), 500

    def is_provider_available(provider):
        """
        Check if the provider has its API key set in environment variables.

        Args:
            provider: The AI provider to check

        Returns:
            bool: True if the provider is available, False otherwise
        """
        # Ollama is a local service and doesn't need an API key
        if provider == "ollama":
            return True

        # OpenAI typically uses OPENAI_API_KEY
        if provider == "openai":
            return os.getenv("OPENAI_API_KEY") is not None

        # Anthropic uses ANTHROPIC_API_KEY
        if provider == "anthropic":
            return os.getenv("ANTHROPIC_API_KEY") is not None

        # Gemini (Google) typically uses GOOGLE_API_KEY
        if provider == "gemini":
            return os.getenv("GOOGLE_API_KEY") is not None

        # Mistral uses MISTRAL_API_KEY (as seen in the providers.py code)
        if provider == "mistral":
            return os.getenv("MISTRAL_API_KEY") is not None

        # Deepseek uses DEEPSEEK_API_KEY
        if provider == "deepseek":
            return os.getenv("DEEPSEEK_API_KEY") is not None

        # xAI uses XAI_API_KEY
        if provider == "xai":
            return os.getenv("XAI_API_KEY") is not None

        # Default to False for unknown providers
        return False

    @app.route('/api/get_available_models', methods=['GET'])
    def get_available_models():
        """
        Return a list of available AI models and providers that have their API keys set.

        Returns:
            JSON response containing available AI models
        """
        try:
            # Define all possible models
            all_models = {
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

            # Filter models to only include those with API keys set
            available_models = {}
            for provider, model_info in all_models.items():
                if is_provider_available(provider):
                    available_models[provider] = model_info

            # Determine a default provider (preferring Anthropic if available)
            default_provider = "anthropic" if "anthropic" in available_models else next(
                iter(available_models), None)

            # Include information about available endpoints
            api_endpoints = {
                "/api/get_ai_response": "Complete, non-streaming response",
                "/api/stream_ai_response": "Streaming response with real-time chunks"
            }

            return jsonify({
                "available_models": available_models,
                "default_provider": default_provider,
                "default_reasoning_effort": "medium",
                "api_endpoints": api_endpoints
            })

        except Exception as e:
            error_message = f"Error getting available models: {str(e)}"
            print(error_message)
            return jsonify({"error": error_message}), 500
