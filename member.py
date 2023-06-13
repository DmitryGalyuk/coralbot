class Member:
    def __init__(self, row):
        self.parent = ""
        self.children = []
        self.grouptotal = 0

        self.rownum = row["rownum"]
        self.level = row["level"].strip()
        self.id = row["id"]
        self.key = self.id
        self.name = row["name"]
        self.title = row["title"]
        self.personalvolume = float(row["personalvolume"].strip() or 0)
        self.nso = row["nso"]
        self.maxzr = row["maxzr"]
        self.monthNoVolume = float(row["monthNoVolume"].strip() or 0)
        self.status = row["status"]
        if len(self.maxzr) > 2:
                self.maxtitle,  self.titlenotclosedmonths = self.maxzr.split('/')
        else:
            self.maxtitle = ""
            self.titlenotclosedmonths = ""

    def calculate_group_total(self):
        self.grouptotal = self.personalvolume

        for child in self.children:
            child.calculate_group_total()
            self.grouptotal += child.grouptotal

    def to_dict(self):
        # make a copy of the __dict__ dictionary
        data = self.__dict__.copy()
        # remove 'children' from the copied dictionary
        data.pop('children', None)
        return data