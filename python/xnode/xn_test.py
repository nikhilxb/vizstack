from importlib import reload
from typing import MutableSequence

import xnode


def test_default_should_print(capsys) -> None:
    reload(xnode)
    xnode.show('Hello world!')
    assert capsys.readouterr().out.strip() == 'Hello world!'


def test_set_view_fn_to_lambda_should_use_lambda() -> None:
    reload(xnode)
    viewed: MutableSequence[str] = []
    xnode.set_show_fn(lambda x: viewed.append(x))
    xnode.show('Hello world!')
    assert len(viewed) == 1 and viewed[0] == 'Hello world!'


def test_view_with_no_args_should_do_nothing(capsys) -> None:
    reload(xnode)
    xnode.show()
    assert len(capsys.readouterr().out.strip()) == 0


def test_view_with_multiple_args_should_print_all(capsys) -> None:
    reload(xnode)
    xnode.show('hello', 'world')
    assert capsys.readouterr().out.strip() == 'hello world'
