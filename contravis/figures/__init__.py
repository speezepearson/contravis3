"""Figure registry with auto-loading of builtins and generated figures."""

from __future__ import annotations

import importlib
import pkgutil
from pathlib import Path

from .base import get_figure, list_figures, register_figure, FigureContext, FigureFunc


def load_builtins():
    """Import all modules in figures/builtin/ to trigger @figure registrations."""
    from . import builtin
    package_path = Path(builtin.__file__).parent
    for _, name, _ in pkgutil.iter_modules([str(package_path)]):
        importlib.import_module(f".builtin.{name}", package="contravis.figures")


def load_generated():
    """Import all modules in figures/generated/ to trigger @figure registrations."""
    from . import generated
    package_path = Path(generated.__file__).parent
    for _, name, _ in pkgutil.iter_modules([str(package_path)]):
        importlib.import_module(f".generated.{name}", package="contravis.figures")


def ensure_loaded():
    """Load all figure modules (idempotent)."""
    load_builtins()
    try:
        load_generated()
    except Exception:
        pass  # generated/ may be empty or have broken modules
