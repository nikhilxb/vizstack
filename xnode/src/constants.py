from dataclasses import dataclass
from typing import Union, NewType, MutableMapping, Mapping, NamedTuple, Optional

# The Python equivalents of the values allowed in JSON
JsonType = Union[str, float, int, bool, None, list, dict]

# Strings which represent the unique identifier for a particular Python object at a particular point in execution
SymbolId = NewType('SymbolId', str)

# Integers which uniquely identify points in execution at which symbol IDs were created
SnapshotId = NewType('SnapshotId', int)

# A set of key-value pairs which describe all of the properties of a symbol needed for visualization
SymbolData = NewType('SymbolData', Mapping[str, JsonType])


# The data structure which is sent to clients to describe a symbol. We use a data class here instead of a named tuple
# since the shell should be mutable.
@dataclass
class SymbolShell:
    type: str
    str: str
    name: Optional[str]
    data: Optional[SymbolData]
    attributes: None


# A slice of a symbol table, mapping symbol IDs to their shells
SymbolSlice = NewType('SymbolSlice', MutableMapping[SymbolId, SymbolShell])

# A description of an action that should be performed on a constructed symbol table slice before being sent to the
# client
Action = NewType('Action', JsonType)

# A mapping of action names to the descriptions of the requested behavior
Actions = NewType('Actions', Mapping[str, Action])


# A description of a client's request to send a symbol table slice at a particular line of the program
class WatchExpression(NamedTuple):
    id: int
    file: str
    lineno: int
    actions: Actions
