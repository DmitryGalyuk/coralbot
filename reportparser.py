import os
import pandas as pd
import member

class ReportParser:
    def __init__(self, filename) -> None:
        self.filename = filename

    def parse(self):
        # Modify these values to suit your file
        num_header_rows = 6  # The number of header rows in your file
        num_footer_rows = 21  # The number of footer rows in your file

        # Read the entire .xlsx file into a DataFrame
        df = pd.read_excel(self.filename, skiprows=num_header_rows, engine='openpyxl', dtype=str)

        # renames columns
        cols = list(df.columns)
        cols[0] = 'rownum'
        cols[1] = 'level'
        cols[2] = 'id'
        cols[3] = 'name'
        cols[4] = 'title'
        cols[5] = 'personalvolume'
        cols[6] = 'nso'
        cols[7] = 'maxzr'
        cols[8] = 'monthNoVolume'
        cols[9] = 'status'
        df.columns = cols

        # Now we need to drop the footer rows. We can do this by negating the number of footer rows.
        df = df.iloc[:-num_footer_rows]

        memberlist = self._pandas_to_list(df)
        self._populate_children(memberlist)
        for m in memberlist:
            m.calculate_group_total()
        
        return memberlist

    def _pandas_to_list(self, df):
        # Initialize an empty dictionary to store parent-child relationships
        parent_child = {}

        # Initialize an empty list to store the nodes
        flat_list = []

        # Iterate through DataFrame rows
        for _, row in df.iterrows():
            # Get member id and level
            m = member.Member(row)
            member_id = m.id
            level = int(m.level.split('.')[1])  # Get the number after the dot in 'level'

            # If this is not a root node (level != 0), its parent is the most recent node at the previous level
            if level != 0:
                # Set parent id
                parent_id = parent_child[level - 1].id
                m.parent = parent_id

            # Store this node as the most recent node at its level
            parent_child[level] = m

            flat_list.append(m)
        return flat_list
    
    def _populate_children(self, members):
        id_member = { m.id : m for m in members }
        for m in members:
            if m.parent:
                id_member[m.parent].children.append(m)


