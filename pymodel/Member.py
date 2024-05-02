'''
Member class
'''
from __future__ import annotations
from typing import Type, List
import pandas as pd


class Member:
    '''
    Member class
    '''
    def __init__(self, id: int, parent, personal: int):
        self.id = id
        self.parent = parent
        self.personal = personal
        self.group = 0
        self.overal = 0
        self.children = []


    @classmethod
    def graph_from_pandas(cls: Type[Member], df: pd.DataFrame) -> Member:
        '''
        Parses flat list of Member instances to graph
        '''
        cls()