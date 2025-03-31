import time
from openai import OpenAI
from mistralai import Mistral
import anthropic
import google.generativeai as genai
import ollama
import tiktoken
from typing import Dict, Any, Literal
import json
import os
import logging

OPENAI_MODEL = "o3-mini"
ANTHROPIC_MODEL = "claude-3-7-sonnet-20250219"
GEMINI_MODEL = "gemini-2.5-pro-exp-03-25"
OLLAMA_MODEL = "llama3"
DEEPSEEK_MODEL = "deepseek-reasoner"
XAI_MODEL = "grok-2-latest"
MISTRAL_MODEL = "mistral-large-latest"

DEFAULT_REASONING_EFFORT = "medium"  # Options: low, medium, high


class AIProvider:
    def __init__(self, provider: Literal["openai", "anthropic", "gemini", "ollama", "deepseek", "xai", "mistral"]):
        self.provider = provider
        self.system_prompt = None
        self.reasoning_effort = DEFAULT_REASONING_EFFORT
        self.logger = logging.getLogger(f"ai_provider.{provider}")

        # Validate that the provider has necessary API keys (except for ollama)
        if not self._check_api_key_available():
            raise ValueError(
                f"API key for {provider} is not available in environment variables")

    def _check_api_key_available(self) -> bool:
        """
        Check if the required API key for the current provider is available.

        Returns:
            bool: True if the key is available or not needed, False otherwise
        """
        # Ollama is a local service and doesn't need an API key
        if self.provider == "ollama":
            return True

        # Check appropriate environment variable for each provider
        if self.provider == "openai":
            return os.getenv("OPENAI_API_KEY") is not None
        elif self.provider == "anthropic":
            return os.getenv("ANTHROPIC_API_KEY") is not None
        elif self.provider == "gemini":
            return os.getenv("GEMINI_API_KEY") is not None
        elif self.provider == "mistral":
            return os.getenv("MISTRAL_API_KEY") is not None
        elif self.provider == "deepseek":
            return os.getenv("DEEPSEEK_API_KEY") is not None
        elif self.provider == "xai":
            return os.getenv("XAI_API_KEY") is not None

        # Default to False for unknown providers
        return False

    def set_reasoning_effort(self, effort: Literal["low", "medium", "high"]):
        """Set the reasoning effort for OpenAI's o-series models."""
        if effort not in ["low", "medium", "high"]:
            self.reasoning_effort = DEFAULT_REASONING_EFFORT
        else:
            self.reasoning_effort = effort
            self.logger.info(f"Set reasoning effort to: {effort}")

    def _get_client(self):
        """Get a fresh client connection for the current provider."""
        try:
            if self.provider == "openai":
                return OpenAI()
            elif self.provider == "anthropic":
                return anthropic.Anthropic()
            elif self.provider == "gemini":
                genai.configure()
                return genai.GenerativeModel(model_name=GEMINI_MODEL)
            elif self.provider == "ollama":
                return None  # Ollama doesn't need a persistent client
            elif self.provider == "mistral":
                return Mistral(api_key=os.getenv("MISTRAL_API_KEY"))
            elif self.provider == "deepseek":
                return OpenAI(
                    api_key=os.getenv("DEEPSEEK_API_KEY"),
                    base_url="https://api.deepseek.com"
                )
            elif self.provider == "xai":
                return OpenAI(
                    api_key=os.getenv("XAI_API_KEY"),
                    base_url="https://api.x.ai/v1"
                )
        except Exception as e:
            raise ValueError(
                f"Error initializing client for {self.provider}: {str(e)}")

    # Rest of the existing methods remain unchanged...
    # [All other methods in the original file would remain here]
    def _handle_openai_response(self, messages: list[Dict[str, str]]) -> Dict[str, Any]:
        try:
            with self._get_client() as client:
                # Check if we're using an o-series model which supports reasoning effort
                extra_params = {}
                if OPENAI_MODEL.startswith('o') and any(char.isdigit() for char in OPENAI_MODEL):
                    extra_params["reasoning_effort"] = self.reasoning_effort
                    self.logger.info(
                        f"Using reasoning effort: {self.reasoning_effort} for model {OPENAI_MODEL}")

                completion = client.chat.completions.create(
                    model=OPENAI_MODEL,
                    messages=messages,
                    **extra_params
                )

                if not completion or not hasattr(completion, 'choices'):
                    raise ValueError(f"Invalid OpenAI response structure")

                if not completion.choices:
                    raise ValueError("No choices in OpenAI response")

                text = completion.choices[0].message.content
                if not text:
                    raise ValueError("Empty content in OpenAI response")

                return {
                    "text": text,
                    "input_tokens": completion.usage.prompt_tokens,
                    "output_tokens": completion.usage.completion_tokens
                }
        except Exception as e:
            raise ValueError(f"OpenAI API error: {str(e)}")

    def _handle_openai_stream(self, messages: list[Dict[str, str]]):
        try:
            with self._get_client() as client:
                # Check if we're using an o-series model which supports reasoning effort
                extra_params = {}
                if OPENAI_MODEL.startswith('o') and any(char.isdigit() for char in OPENAI_MODEL):
                    extra_params["reasoning_effort"] = self.reasoning_effort
                    self.logger.info(
                        f"Using reasoning effort: {self.reasoning_effort} for model {OPENAI_MODEL}")

                response = client.chat.completions.create(
                    model=OPENAI_MODEL,
                    messages=messages,
                    stream=True,
                    **extra_params
                )

                if not response:
                    self.logger.error(
                        f"Raw OpenAI stream response: {response}")
                    raise ValueError("Empty stream from OpenAI")

                for chunk in response:
                    if chunk.choices[0].delta.content is not None:
                        yield chunk.choices[0].delta.content

        except Exception as e:
            raise ValueError(f"OpenAI streaming error: {str(e)}")

    def _handle_mistral_response(self, messages: list[Dict[str, str]]) -> Dict[str, Any]:
        try:
            with self._get_client() as client:
                completion = client.chat.complete(
                    model=MISTRAL_MODEL,
                    messages=messages
                )

                if not completion or not hasattr(completion, 'choices'):
                    self.logger.error(f"Raw Mistral response: {completion}")
                    raise ValueError("Invalid Mistral response structure")

                if not completion.choices:
                    self.logger.error(f"Raw Mistral response: {completion}")
                    raise ValueError("No choices in Mistral response")

                text = completion.choices[0].message.content
                if not text:
                    self.logger.error(f"Raw Mistral response: {completion}")
                    raise ValueError("Empty content in Mistral response")

                # Mistral uses prompt_tokens and completion_tokens in usage
                return {
                    "text": text,
                    "input_tokens": completion.usage.prompt_tokens,
                    "output_tokens": completion.usage.completion_tokens
                }
        except Exception as e:
            raise ValueError(f"Mistral API error: {str(e)}")

    def _handle_mistral_stream(self, messages: list[Dict[str, str]]):
        try:
            with self._get_client() as client:
                stream = client.chat.stream(
                    model=MISTRAL_MODEL,
                    messages=messages
                )

                if not stream:
                    self.logger.error(
                        f"Raw Mistral stream response: {stream}")
                    raise ValueError("Empty stream from Mistral")

                for chunk in stream:
                    if chunk.data.choices[0].delta.content is not None:
                        yield chunk.data.choices[0].delta.content

        except Exception as e:
            raise ValueError(f"Mistral streaming error: {str(e)}")

    def _handle_xai_response(self, messages: list[Dict[str, str]]) -> Dict[str, Any]:
        try:
            with self._get_client() as client:
                completion = client.chat.completions.create(
                    model=XAI_MODEL,
                    messages=messages
                )

                if not completion or not hasattr(completion, 'choices'):
                    self.logger.error(f"Raw XAI response: {completion}")
                    raise ValueError("Invalid XAI response structure")

                if not completion.choices:
                    self.logger.error(f"Raw XAI response: {completion}")
                    raise ValueError("No choices in XAI response")

                text = completion.choices[0].message.content
                if not text:
                    self.logger.error(f"Raw XAI response: {completion}")
                    raise ValueError("Empty content in XAI response")

                return {
                    "text": text,
                    "input_tokens": completion.usage.prompt_tokens,
                    "output_tokens": completion.usage.completion_tokens
                }
        except Exception as e:
            raise ValueError(f"XAI API error: {str(e)}")

    def _handle_xai_stream(self, messages: list[Dict[str, str]]):
        try:
            with self._get_client() as client:
                response = client.chat.completions.create(
                    model=XAI_MODEL,
                    messages=messages,
                    stream=True
                )

                if not response:
                    self.logger.error(f"Raw XAI stream response: {response}")
                    raise ValueError("Empty stream from XAI")

                for chunk in response:
                    if chunk.choices[0].delta.content is not None:
                        yield chunk.choices[0].delta.content

        except Exception as e:
            raise ValueError(f"XAI streaming error: {str(e)}")

    def _handle_anthropic_response(self, messages: list[Dict[str, str]], system_prompt: str) -> Dict[str, Any]:
        try:
            with self._get_client() as client:
                message = client.messages.create(
                    model=ANTHROPIC_MODEL,
                    max_tokens=8192,
                    messages=messages,
                    system=system_prompt if system_prompt else "You are a helpful assistant."
                )

                if not message or not hasattr(message, 'content'):
                    self.logger.error(f"Raw Anthropic response: {message}")
                    raise ValueError("Invalid Anthropic response structure")

                response_parts = [
                    part.text for part in message.content if hasattr(part, 'text')]
                if not response_parts:
                    self.logger.error(f"Raw Anthropic response: {message}")
                    raise ValueError("No text content in Anthropic response")

                text = "\n".join(response_parts)

                return {
                    "text": text,
                    "input_tokens": message.usage.input_tokens,
                    "output_tokens": message.usage.output_tokens
                }
        except Exception as e:
            raise ValueError(f"Anthropic API error: {str(e)}")

    def _handle_anthropic_stream(self, messages: list[Dict[str, str]], system_prompt: str):
        try:
            client = self._get_client()
            with client.messages.stream(
                max_tokens=8192,
                messages=messages,
                model=ANTHROPIC_MODEL,
                system=system_prompt if system_prompt else "You are a helpful assistant."
            ) as stream:
                if not stream:
                    self.logger.error(f"Raw Anthropic stream: {stream}")
                    raise ValueError("Empty stream from Anthropic")

                for text in stream.text_stream:
                    if text:
                        yield text
            client.close()  # Explicitly close the client after streaming

        except Exception as e:
            raise ValueError(f"Anthropic streaming error: {str(e)}")

    def _handle_gemini_response(self, messages: list[Dict[str, str]], system_prompt: str, last_message: str) -> Dict[str, Any]:
        try:
            client = self._get_client()
            if system_prompt:
                client = genai.GenerativeModel(
                    model_name=GEMINI_MODEL,
                    system_instruction=system_prompt
                )

            chat = client.start_chat(history=messages)
            if not chat:
                raise ValueError("Could not initialize Gemini chat")

            response = chat.send_message(last_message)
            if not response or not hasattr(response, 'text'):
                raise ValueError("Invalid Gemini response structure")

            if not response.text:
                raise ValueError("Empty content in Gemini response")

            total_input = "\n".join([msg["parts"][0] for msg in messages])
            total_input += "\n" + last_message
            input_tokens, output_tokens = self._count_tokens(
                total_input, response.text)

            del chat  # Clean up chat session
            if client:
                del client  # Clean up client

            return {
                "text": response.text,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens
            }
        except Exception as e:
            raise ValueError(f"Gemini API error: {str(e)}")

    def _handle_gemini_stream(self, messages: list[Dict[str, str]], system_prompt: str, last_message: str):
        client = None
        try:
            client = self._get_client()
            if system_prompt:
                client = genai.GenerativeModel(
                    model_name=GEMINI_MODEL,
                    system_instruction=system_prompt
                )

            chat = client.start_chat(history=messages)
            if not chat:
                raise ValueError("Could not initialize Gemini chat")

            response = chat.send_message(last_message, stream=True)
            if not response:
                raise ValueError("Empty stream from Gemini")

            for chunk in response:
                if chunk and hasattr(chunk, 'text') and chunk.text:
                    yield chunk.text

            del chat  # Clean up chat session

        except Exception as e:
            raise ValueError(f"Gemini streaming error: {str(e)}")
        finally:
            if client:
                del client

    def _handle_ollama_response(self, messages: list[Dict[str, str]]) -> Dict[str, Any]:
        try:
            response = ollama.chat(
                model=OLLAMA_MODEL,
                messages=messages
            )

            if not response or not hasattr(response, 'message'):
                raise ValueError("Invalid Ollama response structure")

            text = response.message.content
            if not text:
                raise ValueError("Empty content in Ollama response")

            total_input = "\n".join([msg["content"] for msg in messages])
            input_tokens, output_tokens = self._count_tokens(total_input, text)

            return {
                "text": text,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens
            }
        except Exception as e:
            raise ValueError(f"Ollama API error: {str(e)}")

    def _handle_ollama_stream(self, messages: list[Dict[str, str]]):
        """Stream responses from Ollama using native streaming support.

        Args:
            messages: List of message dictionaries with 'role' and 'content' keys

        Yields:
            Text chunks from the streaming response
        """
        try:
            stream = ollama.chat(
                model=OLLAMA_MODEL,
                messages=messages,
                stream=True
            )

            if not stream:
                raise ValueError("Empty stream from Ollama")

            for chunk in stream:
                if chunk and chunk.message and chunk.message.content:
                    yield chunk.message.content

        except Exception as e:
            raise ValueError(f"Ollama streaming error: {str(e)}")

    def _handle_deepseek_response(self, messages: list[Dict[str, str]]) -> Dict[str, Any]:
        max_retries = 1
        retry_count = 0
        last_error = None

        while retry_count <= max_retries:
            try:
                with self._get_client() as client:
                    completion = client.chat.completions.create(
                        model=DEEPSEEK_MODEL,
                        messages=messages
                    )

                    if not completion or not hasattr(completion, 'choices'):
                        raise ValueError("Invalid Deepseek response structure")

                    if not completion.choices:
                        raise ValueError("No choices in Deepseek response")

                    text = completion.choices[0].message.content
                    if not text:
                        raise ValueError("Empty content in Deepseek response")

                    return {
                        "text": text,
                        "input_tokens": completion.usage.prompt_tokens,
                        "output_tokens": completion.usage.completion_tokens
                    }
            except Exception as e:
                last_error = e
                retry_count += 1
                if retry_count <= max_retries:
                    time.sleep(2)  # Add a short delay before retrying
                else:
                    raise ValueError(
                        f"Deepseek API error after {max_retries} retries: {str(e)}"
                    ) from last_error

    def _handle_deepseek_stream(self, messages: list[Dict[str, str]]):
        max_retries = 1
        retry_count = 0
        last_error = None

        while retry_count <= max_retries:
            try:
                with self._get_client() as client:
                    response = client.chat.completions.create(
                        model=DEEPSEEK_MODEL,
                        messages=messages,
                        stream=True
                    )

                    if not response:
                        raise ValueError("Empty response stream from Deepseek")

                    for chunk in response:
                        if not chunk or not hasattr(chunk, 'choices') or not chunk.choices:
                            continue

                        choice = chunk.choices[0]
                        if not hasattr(choice, 'delta') or not hasattr(choice.delta, 'content'):
                            continue

                        content = choice.delta.content
                        if not content:
                            continue

                        yield content

                    # If we get here successfully, break out of the retry loop
                    break

            except Exception as e:
                last_error = e
                retry_count += 1
                if retry_count <= max_retries:
                    time.sleep(2)  # Add a short delay before retrying
                else:
                    raise ValueError(
                        f"Deepseek streaming error after {max_retries} retries: {str(e)}"
                    ) from last_error

    def _count_tokens(self, input_text: str, output_text: str = "") -> tuple[int, int]:
        """Count tokens for input and output text."""
        try:
            if self.provider == "gemini":
                client = self._get_client()
                input_count = client.count_tokens(input_text).total_tokens
                output_count = client.count_tokens(
                    output_text).total_tokens if output_text else 0
                del client
            else:
                encoding = tiktoken.encoding_for_model("gpt-4")
                input_count = len(encoding.encode(input_text))
                output_count = len(encoding.encode(
                    output_text)) if output_text else 0
            return input_count, output_count
        except Exception as e:
            return 0, 0

    def _prepare_messages(self, messages: list[Dict[str, str]]) -> tuple[list[Dict[str, str]], str | None]:
        """Prepare messages based on provider format and extract system prompt."""
        try:
            system_prompt = None
            filtered_messages = []

            for msg in messages:
                if msg["role"] == "system":
                    system_prompt = msg["content"]
                else:
                    filtered_messages.append(msg)

            if self.provider == "gemini":
                gemini_messages = []
                for msg in filtered_messages:
                    role = "model" if msg["role"] == "assistant" else "user"
                    gemini_messages.append(
                        {"role": role, "parts": [msg["content"]]})
                return gemini_messages, system_prompt

            return filtered_messages, system_prompt
        except Exception as e:
            raise ValueError(
                f"Error preparing messages for {self.provider}: {str(e)}"
            )

    def prompt(self, message: str) -> Dict[str, Any]:
        """Prompt the AI provider with the given message.

        Args:
            message: The message to prompt the AI provider with.

        Returns:
            Dictionary containing response text, token usage information, and execution time
        """
        try:
            response = self.get_response(
                [{"role": "user", "content": message}])
            return response
        except Exception as e:
            raise ValueError(
                f"Error prompting {self.provider}: {str(e)}"
            )

    def get_response(self, messages: list[Dict[str, str]]) -> Dict[str, Any]:
        start_time = time.time()

        try:
            for idx, msg in enumerate(messages):
                content_lines = msg['content'].split('\n')

            response_data = None
            if self.provider == "openai":
                response_data = self._handle_openai_response(messages)
            elif self.provider == "anthropic":
                filtered_messages, system_prompt = self._prepare_messages(
                    messages)
                response_data = self._handle_anthropic_response(
                    filtered_messages, system_prompt)
            elif self.provider == "gemini":
                messages_list, system_prompt = self._prepare_messages(
                    messages[:-1])
                last_message = messages[-1]["content"] if messages else ""
                response_data = self._handle_gemini_response(
                    messages_list, system_prompt, last_message)
            elif self.provider == "ollama":
                response_data = self._handle_ollama_response(messages)
            elif self.provider == "mistral":
                response_data = self._handle_mistral_response(messages)
            elif self.provider == "xai":
                response_data = self._handle_xai_response(messages)
            elif self.provider == "deepseek":
                response_data = self._handle_deepseek_response(messages)

            if not response_data:
                raise ValueError(
                    f"No response data received from {self.provider}")

            response_data["time_taken"] = time.time() - start_time

            response_lines = response_data['text'].split('\n')

            return response_data

        except Exception as e:
            raise ValueError(
                f"Error getting response from {self.provider}: {str(e)}"
            ) from e

    def stream_response(self, messages: list[Dict[str, str]]):
        """Stream responses from the AI provider with enhanced error handling."""
        start_time = time.time()
        try:
            if self.provider == "openai":
                yield from self._handle_openai_stream(messages)
            elif self.provider == "anthropic":
                filtered_messages, system_prompt = self._prepare_messages(
                    messages)
                yield from self._handle_anthropic_stream(filtered_messages, system_prompt)
            elif self.provider == "gemini":
                messages_list, system_prompt = self._prepare_messages(
                    messages[:-1])
                last_message = messages[-1]["content"] if messages else ""
                yield from self._handle_gemini_stream(messages_list, system_prompt, last_message)
            elif self.provider == "ollama":
                yield from self._handle_ollama_stream(messages)
            elif self.provider == "mistral":
                yield from self._handle_mistral_stream(messages)
            elif self.provider == "xai":
                yield from self._handle_xai_stream(messages)
            elif self.provider == "deepseek":
                yield from self._handle_deepseek_stream(messages)

        except Exception as e:
            error_msg = f"Error during streaming from {self.provider}: {str(e)}"
            raise Exception(error_msg)
