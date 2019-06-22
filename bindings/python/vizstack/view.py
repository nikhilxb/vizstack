"""
This file defines all functions and objects which can be used by developers to create visualizations for their objects.
"""

import inspect
import os
import types
import typing
from collections import defaultdict
from typing import Any, Iterable, Optional, List, Tuple, Union, Dict

from vizstack.types import View, ViewPlaceholder, ViewDict

__all__ = ['Text', 'Token', 'Image', 'Flow', 'Sequence', 'Switch', 'KeyValues', 'Grid', 'DagLayout']

# ======================================================================================================================
# View function tools.
# -------------------
# Functions and classes which might be used by a developer writing a new viz function for their object.
# ======================================================================================================================

# The name of the method on an object which should return a `View` depicting that object.
VIZ_FN = '__view__'

_CURRENT_PLACEHOLDERS = dict()


def get_view(o: Any) -> Union['View', 'ViewPlaceholder']:
    """Gets the View associated with ``o``.

    If ``o`` is already a View, it is returned unchanged. If ``o`` has an ``xn()`` method, its value is returned.
    Otherwise, a default visualization for ``o``, depending on its type, is returned.

    Args:
        o: An object to be visualized.

    Returns:
        A View which describes how to render ``o``.
    """
    global _CURRENT_PLACEHOLDERS
    if id(o) in _CURRENT_PLACEHOLDERS:
        return _CURRENT_PLACEHOLDERS[id(o)]
    _CURRENT_PLACEHOLDERS[id(o)] = ViewPlaceholder()
    should_replace = False
    if isinstance(o, (View, ViewPlaceholder)):
        view = o
    elif hasattr(o, VIZ_FN):
        view = getattr(o, VIZ_FN)()
    elif isinstance(o, (str, int, float, bool)) or o is None:
        view = Token(o if not isinstance(o, str) else '"{}"'.format(o))
    # TODO: come up with a better method for dispatching default vizzes, like stubs
    elif isinstance(o, list):
        view = _SwitchSequence(
            o,
            start_motif='List[{}] ['.format(len(o)),
            end_motif=']',
            summary='List[{}]'.format(len(o)))
        should_replace = True
    elif isinstance(o, set):
        view = _SwitchSequence(
            o,
            start_motif='Set[{}] {{'.format(len(o)),
            end_motif='}',
            summary='Set[{}]'.format(len(o)))
        should_replace = True
    elif isinstance(o, tuple):
        view = _SwitchSequence(
            o,
            start_motif='Tuple[{}] ('.format(len(o)),
            end_motif=')',
            summary='Tuple[{}]'.format(len(o)))
        should_replace = True
    elif isinstance(o, dict):
        view = _SwitchKeyValues(
            o,
            start_motif='Dict[{}] {{'.format(len(o)),
            end_motif='}',
            summary='Dict[{}]'.format(len(o)))
        should_replace = True
    elif isinstance(
            o, (types.FunctionType, types.MethodType, type(all.__call__))):
        args = []
        kwargs = dict()
        for param_name, param in inspect.signature(o).parameters.items():
            if param.default is inspect._empty:
                args.append(param_name)
            else:
                kwargs[param_name] = param.default
        view = _SwitchSequence([
            _SwitchSequence(
                args,
                start_motif='Positional Args [',
                end_motif=']',
                summary='Args',
                expansion_mode='compact'),
            _SwitchKeyValues(
                kwargs,
                start_motif='Keyword Args {',
                end_motif='}',
                summary='Kwargs',
                expansion_mode='compact'),
        ],
            start_motif='Function[{}] ('.format(o.__name__),
            end_motif=')',
            orientation='vertical',
            summary='Function[{}]'.format(o.__name__))
        should_replace = True
    elif inspect.ismodule(o):
        attributes = dict()
        for attr in filter(lambda a: not a.startswith('__'), dir(o)):
            # There are some functions, like torch.Tensor.data, which exist just to throw errors. Testing these
            # fields will throw the errors. We should consume them and keep moving if so.
            try:
                value = getattr(o, attr)
                if not inspect.ismodule(
                        value
                ):  # Prevent recursing through many modules for no reason
                    attributes[attr] = getattr(o, attr)
            except Exception:
                continue
        view = _SwitchKeyValues(
            attributes,
            start_motif='Module[{}] {{'.format(o.__name__),
            end_motif='}',
            summary='Module[{}]'.format(o.__name__))
        should_replace = True
    elif inspect.isclass(o):
        functions = dict()
        staticfields = dict()
        for attr in filter(lambda a: not a.startswith('__'), dir(o)):
            try:
                value = getattr(o, attr)
                if inspect.isfunction(value):
                    functions[attr] = value
                else:
                    staticfields[attr] = value
            except AttributeError:
                continue
        contents = []
        if len(functions) > 0:
            contents.append(
                _SwitchKeyValues(
                    functions,
                    start_motif='Functions {',
                    end_motif='}',
                    summary='Functions',
                    expansion_mode='compact'))
        if len(staticfields) > 0:
            contents.append(
                _SwitchKeyValues(
                    staticfields,
                    start_motif='Fields {',
                    end_motif='}',
                    summary='Fields',
                    expansion_mode='compact'))
        view = _SwitchSequence(
            contents,
            start_motif='Class[{}] ('.format(o.__name__),
            end_motif=')',
            summary='Class[{}]'.format(o.__name__),
            orientation='vertical')
        should_replace = True
    else:
        instance_class = type(o)
        instance_class_attrs = dir(instance_class)
        contents = dict()
        for attr in filter(lambda a: not a.startswith('__'), dir(o)):
            value: Any = getattr(o, attr)
            try:
                if not isinstance(
                        value,
                        (types.FunctionType, types.MethodType, type(all.__call__)
                         )) and (attr not in instance_class_attrs
                                 or getattr(instance_class, attr, None) != value):
                    contents[attr] = value
            except Exception:
                # If some unexpected error occurs (as any object can override `getattr()` like Pytorch does,
                # and raise any error), just skip over instead of crashing
                continue
        view = _SwitchKeyValues(
            contents,
            item_separator='=',
            start_motif='Instance[{}] {{'.format(type(o).__name__),
            end_motif='}',
            summary='Instance[{}]'.format(type(o).__name__))
        should_replace = True
    if should_replace:
        _CURRENT_PLACEHOLDERS[id(o)].view = Switch(view._modes[-1:] + view._modes[:-1], view._items)
    else:
        _CURRENT_PLACEHOLDERS[id(o)].view = view
    del _CURRENT_PLACEHOLDERS[id(o)]
    return view


# ======================================================================================================================
# View classes.
# -----------------
# These objects subclass View and will be instantiated directly by developers writing visualizations for their objects.
# ======================================================================================================================


class Text(View):
    """
    A View which renders a contiguous block of text.
    """

    def __init__(self,
                 text: str,
                 color: Optional[str] = None,
                 variant: Optional[str] = None) -> None:
        """
        Args:
            text: The text which should be rendered.
            color: The color of the text.
            variant: The variant of the text; one of either "plain" or "token".
        """
        super(Text, self).__init__()
        self._text: str = text
        self._color: str = color
        self._variant: str = variant

    def assemble_dict(self) -> ViewDict:
        return ViewDict({
            'type': 'TextPrimitive',
            'contents': {
                'text': self._text,
                'color': self._color,
                'variant': self._variant,
            },
            'meta': self._meta,
        })


class Image(View):
    """
    A View which renders an image as read from a file.
    """

    def __init__(self, file_path: str) -> None:
        """
        Args:
            file_path: The local path to the image file.
        """
        super(Image, self).__init__()
        self._file_path: str = os.path.abspath(file_path)

    def assemble_dict(self) -> ViewDict:
        return ViewDict({
            'type': 'ImagePrimitive',
            'contents': {
                'filePath': self._file_path,
            },
            'meta': self._meta,
        })


class Token(Text):
    """
    A View which renders a string representation of any object.
    """

    def __init__(self, o: Any) -> None:
        """
        Args:
            o: The object whose string representation should be rendered.
        """
        super(Token, self).__init__(str(o), variant='token')


class Flow(View):
    """
    A View which renders other Vizzes as a series of inline elements.
    """

    def __init__(self, items: Iterable[Any]) -> None:
        """
        Args:
            items: A sequence of objects which should be visualized.
        """
        super(Flow, self).__init__()
        self._elements: List[View] = [get_view(o) for o in items]

    def item(self, item: Any):
        self._elements.append(get_view(item))
        return self

    def assemble_dict(self) -> ViewDict:
        return ViewDict({
            'type': 'FlowLayout',
            'contents': {
                'elements': self._elements,
            },
            'meta': self._meta,
        })


_DEFAULT_ITEM = object()
_DEFAULT_PARENT = object()


class DagLayout(View):
    def __init__(self,
                 flow_direction: Optional[str] = None,
                 align_children: Optional[bool] = None) -> None:
        super(DagLayout, self).__init__()
        self._flow_direction = flow_direction
        self._align_children = align_children
        self._nodes: Dict[str, dict] = defaultdict(dict)
        self._items: Dict[str, View] = dict()
        self._edges: List[dict] = []
        self._alignments: List[List[str]] = []

    def node(self, node_id: str,
             flow_direction: Optional[str] = None, align_children: Optional[bool] = None,
             is_expanded: Optional[bool] = None, is_interactive: Optional[bool] = None,
             is_visible: Optional[bool] = None, parent=_DEFAULT_PARENT,
             align_with: Optional[List[str]] = None,
             item: Any = _DEFAULT_ITEM,
             ports: Optional[List[Union[Tuple[str, str, str], Tuple[str, str, str, int]]]] = None):
        for key, var in {
            'flowDirection': flow_direction,
            'alignChildren': align_children,
            'isExpanded': is_expanded,
            'isInteractive': is_interactive,
            'isVisible': is_visible,
        }.items():
            if var is not None or key not in self._nodes[node_id]:
                self._nodes[node_id][key] = var
        if parent is not _DEFAULT_PARENT:
            self._nodes[node_id]['parent'] = parent
        elif 'parent' not in self._nodes[node_id]:
            self._nodes[node_id]['parent'] = None

        self._nodes[node_id]['children'] = []
        if align_with is not None:
            self._alignments.append([node_id] + align_with)
        if item is not _DEFAULT_ITEM:
            self.item(item, node_id)
        if ports is not None:
            for port in ports:
                self.port(*port)
        return self

    def port(self, node_id: str, port_name: str, side: str, order: Optional[int] = None):
        if 'ports' not in self._nodes[node_id]:
            self._nodes[node_id]['ports'] = {}
        self._nodes[node_id]['ports'][port_name] = {
            'side': side,
        }
        if order is not None:
            self._nodes[node_id]['ports'][port_name]['order'] = order
        return self

    # TODO: remove id and name everywhere
    def edge(self, start_node_id: str, end_node_id: str,
             start_port: Optional[str] = None, end_port: Optional[str] = None):
        edge = {
            'startId': start_node_id,
            'endId': end_node_id,
        }
        if start_port is not None:
            edge['startPort'] = start_port
        if end_port is not None:
            edge['endPort'] = end_port
        self._edges.append(edge)
        return self

    def item(self, item: Any, node_id: str):
        self._items[node_id] = get_view(item)
        return self

    def assemble_dict(self) -> ViewDict:
        for node_id in self._nodes:
            # All nodes must have an item
            assert node_id in self._items, 'No item was provided for node "{}".'.format(node_id)
            # All node parents must exist
            assert self._nodes[node_id]['parent'] is None or self._nodes[node_id][
                'parent'] in self._nodes, 'Parent node "{}" not found for child "{}".'.format(
                self._nodes[node_id]['parent'], node_id)
        for edge in self._edges:
            # All edges must connect real nodes
            assert edge['startId'] in self._nodes, 'An edge starts at non-existent node "{}".'.format(edge['startId'])
            assert edge['endId'] in self._nodes, 'An edge ends at non-existent node "{}".'.format(edge['endId'])
            # All edge ports must exist
            if 'startPort' in edge:
                assert edge['startPort'] in self._nodes[edge['startId']][
                    'ports'], 'An edge starts at non-existent port "{}" on node "{}".'.format(edge['startPort'],
                                                                                              edge['startId'])
            if 'endPort' in edge:
                assert edge['endPort'] in self._nodes[edge['endId']][
                    'ports'], 'An edge ends at non-existent port "{}" on node "{}".'.format(edge['endPort'],
                                                                                            edge['endId'])
        return ViewDict({
            'type': 'DagLayout',
            'contents': {
                'nodes':
                    {node_id: {
                    **{key: value for key, value in node.items() if value is not None and key is not 'parent'},
                    'viewId': self._items[node_id],
                    'children': [_node_id for _node_id in self._nodes if self._nodes[_node_id]['parent'] == node_id]}
                     for node_id, node in self._nodes.items()},
                'edges':
                    {str(i): edge
                     for i, edge in enumerate(self._edges)},
                'alignments': self._alignments,
                'flowDirection':
                    self._flow_direction,
                'alignChildren':
                    self._align_children,
            },
            'meta': self._meta,
        })


# TODO: ensure no overlap of elements
class Grid(View):
    """
   A View which renders other Vizzes in a flexibly-sized grid.
   """

    def __init__(self, cells: Optional[str] = None, items: Optional[Dict[str, Any]] = None) -> None:
        """
        Args:
            elements: The contents of the grid as a list of tuples. Each tuple is of the form
                ``(obj, col, row, width, height)``,
                where ``obj`` is the object to be visualized, ``col`` is its horizontal position in the grid,
                ``row`` is its vertical position, ``width`` is the number of columns it should span, and ``height``
                is the number of rows it should span.
        """
        super(Grid, self).__init__()
        self._cells = dict()
        if cells is not None:
            cell_bounds = dict()
            row_len = None
            for y, row in enumerate(cells.splitlines()):
                if row_len is None:
                    row_len = len(row)
                else:
                    # TODO: meaningful error here
                    assert len(row) == row_len
                current_char = None
                for x, c in enumerate(row):
                    if c not in cell_bounds:
                        cell_bounds[c] = {
                            'x': x, 'y': y, 'X': -1, 'Y': -1
                        }
                    cell_bounds[c]['Y'] = y + 1
                    if current_char is None:
                        current_char = c
                    elif current_char != c:
                        cell_bounds[current_char]['X'] = x
                        current_char = c
                    cell_bounds[current_char]['X'] = row_len
            for cell_name, cell_bound in cell_bounds.items():
                self._cells[cell_name] = {
                    'col': cell_bound['x'],
                    'row': cell_bound['y'],
                    'width': cell_bound['X'] - cell_bound['x'],
                    'height': cell_bound['Y'] - cell_bound['y'],
                }
        # TODO: assert non-overlapping
        if items is not None:
            self._items = {key: get_view(value) for key, value in items.items()}
        else:
            self._items = dict()

    def cell(self, cell_name: str, col: int, row: int, width: int, height: int):
        self._cells[cell_name] = {
            'col': col,
            'row': row,
            'width': width,
            'height': height,
        }
        # TODO: assert non-overlapping
        return self

    def item(self, item: Any, cell_name: str):
        self._items[cell_name] = get_view(item)
        return self

    def assemble_dict(self) -> ViewDict:
        for cell_name in self._cells:
            assert cell_name in self._items, 'No item was provided for cell "{}".'.format(cell_name)
        return ViewDict({
            'type': 'GridLayout',
            'contents': {
                'elements': [{**cell, 'viewId': self._items[cell_name]} for cell_name, cell in self._cells.items()],
            },
            'meta': self._meta,
        })


class Switch(View):
    """
    """

    def __init__(self,
                 modes: Optional[List[str]] = None,
                 items: Optional[Dict[str, Any]] = None) -> None:
        """
        """
        super(Switch, self).__init__()
        if modes is not None:
            self._modes = modes
        else:
            self._modes = []
        if items is not None:
            self._items = {key: get_view(value) for key, value in items.items()}
        else:
            self._items = dict()

    def mode(self, mode_name: str, index: Optional[int] = None):
        if index is not None:
            self._modes.insert(index, mode_name)
        else:
            self._modes.append(mode_name)
        return self

    def item(self, item: Any, mode_name: str):
        self._items[mode_name] = item
        return self

    def assemble_dict(self) -> ViewDict:
        for mode_name in self._modes:
            assert mode_name in self._items, 'No item was provided for mode "{}".'.format(mode_name)
        return ViewDict({
            'type': 'SwitchLayout',
            'contents': {
                'elements': [self._items[mode_name] for mode_name in self._modes],
            },
            'meta': self._meta,
        })


class Sequence(View):
    """
    A View which renders other Vizzes as blocks arranged in a fixed order.
    """

    def __init__(self,
                 elements: Optional[Iterable[Any]] = None,
                 start_motif: Optional[str] = None,
                 end_motif: Optional[str] = None,
                 orientation: str = 'horizontal') -> None:
        """
        Args:
            elements: A sequence of objects which should be visualized.
            orientation: How to arrange the elements of this View. Should be either "horizontal" or "vertical".
        """
        super(Sequence, self).__init__()
        self._orientation = orientation
        self._start_motif = Text(start_motif) if start_motif is not None else None
        self._end_motif = Text(end_motif) if end_motif is not None else None
        self._elements = [get_view(o) for o in elements] if elements is not None else []

    def item(self, item: Any):
        self._elements.append(get_view(item))
        return self

    def assemble_dict(self):
        grid = Grid()
        update_index = 0 if self._orientation == 'horizontal' else 1
        current_position = [0, 0]
        if self._start_motif is not None:
            grid.cell('start_motif', *current_position, 1, 1)
            grid.item(self._start_motif, 'start_motif')
            current_position[update_index] += 1
        for i, item in enumerate(self._elements):
            grid.cell('{}'.format(i), *current_position, 1, 1)
            grid.item(item, '{}'.format(i))
            current_position[update_index] += 1
        if self._end_motif is not None:
            grid.cell('end_motif', *current_position, 1, 1)
            grid.item(self._end_motif, 'end_motif')
        return grid.assemble_dict()


class KeyValues(View):
    """
    A View which renders other Vizzes as key-value pairs.
    """

    def __init__(self,
                 key_value_mapping: Optional[Dict[Any, Any]] = None,
                 item_separator: str = ':',
                 start_motif: Optional[str] = None,
                 end_motif: Optional[str] = None) -> None:
        """Constructor.

        Args:
            key_value_mapping: A mapping of objects which should be visualized as key-value pairs
            summary: An optional string which will be shown when the ``KeyValues`` is in its summary expansion
                mode.
            expansion_mode: An optional expansion mode which the ``KeyValues`` should adopt by default.
        """
        super(KeyValues, self).__init__()
        self._start_motif = Text(start_motif) if start_motif is not None else None
        self._end_motif = Text(end_motif) if end_motif is not None else None
        self._item_separator = item_separator
        self._elements = [] if key_value_mapping is None else [(get_view(key), get_view(value)) for key, value in
                                                               key_value_mapping.items()]

    def item(self, key: Any, value: Any):
        self._elements.append((get_view(key), get_view(value)))
        return self

    def assemble_dict(self):
        grid = Grid()
        current_row = 0
        if self._start_motif is not None:
            grid.cell('start_motif', 0, current_row, 3, 1)
            grid.item(self._start_motif, 'start_motif')
            current_row += 1
        for i, (key, value) in enumerate(self._elements):
            grid.cell('k{}'.format(i), 0, current_row, 1, 1)
            grid.item(key, 'k{}'.format(i))
            grid.cell('sep{}'.format(i), 1, current_row, 1, 1)
            grid.item(Text(self._item_separator), 'sep{}'.format(i))
            grid.cell('v{}'.format(i), 2, current_row, 1, 1)
            grid.item(value, 'v{}'.format(i))
            current_row += 1
        if self._end_motif is not None:
            grid.cell('end_motif', 0, current_row, 3, 1)
            grid.item(self._end_motif, 'end_motif')
        return grid.assemble_dict()


_COMPACT_LEN = 3


def _SwitchSequence(
        elements: Optional[typing.Sequence[Any]] = None,
        start_motif: Optional[str] = None,
        end_motif: Optional[str] = None,
        orientation: str = 'horizontal',
        summary: Optional[str] = None,
        expansion_mode: Optional[str] = None):
    full_view = Sequence(elements, start_motif, end_motif, orientation)
    compact_view = Sequence(elements[:_COMPACT_LEN], start_motif, end_motif, orientation)
    compact_view.item('...')
    summary_view = summary if summary is not None else 'sequence[{}]'.format(len(elements))
    if len(elements) <= _COMPACT_LEN:
        modes = ['full', 'summary'] if expansion_mode != 'summary' else ['summary', 'full']
        return Switch(modes, {'full': full_view, 'summary': summary_view})
    modes = ['full', 'compact', 'summary']
    if expansion_mode is not None:
        modes = modes[:modes.index(expansion_mode)] + modes[modes.index(expansion_mode):]
    return Switch(modes, {'full': full_view, 'compact': compact_view, 'summary': summary_view})


def _SwitchKeyValues(
        key_value_mapping: Dict[Any, Any],
        item_separator: str = ':',
        start_motif: Optional[str] = None,
        end_motif: Optional[str] = None,
        summary: Optional[str] = None,
        expansion_mode: Optional[str] = None):
    full_view = KeyValues(key_value_mapping, item_separator, start_motif, end_motif)
    compact = dict()
    for i, (key, value) in enumerate(key_value_mapping.items()):
        if i >= _COMPACT_LEN:
            break
        compact[key] = value
    compact_view = KeyValues(compact, item_separator, start_motif, '...')
    summary_view = summary if summary is not None else 'dict[{}]'.format(len(key_value_mapping))
    if len(key_value_mapping) <= _COMPACT_LEN:
        modes = ['full', 'summary'] if expansion_mode != 'summary' else ['summary', 'full']
        return Switch(modes, {'full': full_view, 'summary': summary_view})
    modes = ['full', 'compact', 'summary']
    if expansion_mode is not None:
        modes = modes[:modes.index(expansion_mode)] + modes[modes.index(expansion_mode):]
    return Switch(modes, {'full': full_view, 'compact': compact_view, 'summary': summary_view})
