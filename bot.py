import reportparser

p = reportparser.ReportParser("./data.xlsx")
data = p.parse()

serializable = [n.to_dict() for n in data]

f = open("data.js", "w", encoding='utf-8')
f.write("d="+ str(serializable) )
f.close()