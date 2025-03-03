from setuptools import setup, find_packages

setup(
    name="prompter",
    version="0.1.0",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "flask",
        "click",
    ],
    entry_points={
        "console_scripts": [
            "prompter=cli:main",
        ],
    },
    python_requires=">=3.7",
)