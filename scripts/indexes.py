import json,itertools
from pathlib import Path
indexes=[]
def add(group,fields):
 entry={'collectionGroup':group,'queryScope':'COLLECTION','fields':[{'fieldPath':f,'order':d} for f,d in fields]}
 if entry not in indexes:indexes.append(entry)
for length in range(4):
 for optional in itertools.combinations(['assignedToUid','stage','source'],length):
  eq=['archived',*optional]
  add('leads',[(f,'ASCENDING') for f in eq]+[('id','DESCENDING')])
  for exact in ['phoneNormalized','email']:
   add('leads',[(f,'ASCENDING') for f in [*eq,exact]]+[('id','DESCENDING')])
  for prefix in ['nameNormalized','companyNormalized']:
   add('leads',[(f,'ASCENDING') for f in eq]+[(prefix,'ASCENDING'),('id','ASCENDING')])
for fields in [['leadId','state'],['recipientUid'],['recipientUid','state'],['recipientUid','leadId'],['recipientUid','state','leadId']]:
 add('tasks',[(f,'ASCENDING') for f in fields]+[('dueAt','ASCENDING'),('id','ASCENDING')])
add('tasks',[('leadId','ASCENDING'),('state','ASCENDING'),('id','ASCENDING')])
add('tasks',[('recipientUid','ASCENDING'),('state','ASCENDING'),('dueAt','ASCENDING')])
add('activities',[('leadId','ASCENDING'),('id','DESCENDING')])
add('activities',[('leadId','ASCENDING'),('type','ASCENDING'),('id','DESCENDING')])
add('importChunks',[('importId','ASCENDING'),('id','DESCENDING')])
add('activities',[('actorUid','ASCENDING'),('type','ASCENDING'),('createdAt','ASCENDING')])
add('activities',[('actorUid','ASCENDING'),('type','ASCENDING'),('outcome','ASCENDING'),('createdAt','ASCENDING')])
add('reminderDeliveries',[('status','ASCENDING'),('nextAttemptAt','ASCENDING'),('id','ASCENDING')])
add('noteAnalyses',[('status','ASCENDING'),('nextAttemptAt','ASCENDING'),('id','ASCENDING')])
add('devices',[('enabled','ASCENDING'),('id','ASCENDING')])
Path('firestore.indexes.json').write_text(json.dumps({'indexes':indexes,'fieldOverrides':[{'collectionGroup':'rateLimits','fieldPath':'expiresAt','ttl':True,'indexes':[]}]},indent=2)+'\n')
