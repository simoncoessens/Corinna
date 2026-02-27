"""Shared prompt-loading utility for all agents.

Each agent has its own ``prompts/`` directory with Jinja2 templates.  Rather
than duplicating the Jinja ``Environment`` boilerplate in every ``graph.py``,
agents can call::

    load_prompt = create_prompt_loader(Path(__file__).resolve().parent / "prompts")
    load_prompt("system.jinja", context=ctx)
"""

from __future__ import annotations

from pathlib import Path
from typing import Callable

from jinja2 import Environment, FileSystemLoader


def create_prompt_loader(prompts_dir: Path) -> Callable[..., str]:
    """Return a ``load_prompt(template_name, **kwargs)`` function for *prompts_dir*."""
    env = Environment(
        loader=FileSystemLoader(str(prompts_dir)),
        trim_blocks=True,
        lstrip_blocks=True,
    )

    def load_prompt(template_name: str, **kwargs: object) -> str:
        """Load and render a Jinja2 prompt template."""
        template = env.get_template(template_name)
        return template.render(**kwargs)

    return load_prompt
