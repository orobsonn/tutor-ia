import type { SurveyState } from './domain/survey.ts';

// Each denominator describes eligibility; unknown and non-use are never negative ratings.
export function surveyMetrics(records: SurveyState[]) {
  records=records.filter(row=>!row.testMode);
  const performed=records.filter(row=>row.attendance==='performed');
  const courseUsers=performed.filter(row=>row.courseUsed===true);
  const simulationUsers=performed.filter(row=>row.simulationUsed===true);
  const comparable=(value:unknown)=>['much','partly','little'].includes(String(value));
  return [
    {label:'Provas realizadas / tentativas',value:performed.length,total:records.length},
    {label:'Resultados conhecidos / provas realizadas',value:performed.filter(row=>['approved','failed'].includes(String(row.result))).length,total:performed.length},
    {label:'Resultados pendentes / provas realizadas',value:performed.filter(row=>row.result==='pending').length,total:performed.length},
    {label:'Curso: avaliações / usuários',value:courseUsers.filter(row=>comparable(row.courseAlignment)).length,total:courseUsers.length},
    {label:'Curso: não usaram / provas realizadas',value:performed.filter(row=>row.courseUsed===false).length,total:performed.length},
    {label:'Simulados: conteúdo avaliado / usuários',value:simulationUsers.filter(row=>comparable(row.simulationContent)).length,total:simulationUsers.length},
    {label:'Simulados: formato avaliado / usuários',value:simulationUsers.filter(row=>comparable(row.simulationFormat)).length,total:simulationUsers.length},
    {label:'Simulados: dificuldade comparada / usuários',value:simulationUsers.filter(row=>['easier','same','harder'].includes(String(row.simulationDifficulty))).length,total:simulationUsers.length},
    {label:'Simulados: não usaram / provas realizadas',value:performed.filter(row=>row.simulationUsed===false).length,total:performed.length},
  ];
}
