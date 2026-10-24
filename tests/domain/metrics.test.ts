import test from 'node:test';
import assert from 'node:assert/strict';
import {createSurvey} from '../../src/domain/survey.ts';
import {surveyMetrics} from '../../src/metrics.ts';

test('metrics preserve eligibility, pending and non-use without treating unknown as negative',()=>{
 const base=createSurvey('demo','test');
 const rows=[
 {...base,attendance:'performed' as const,result:'pending' as const,courseUsed:true,courseAlignment:'unknown' as const,simulationUsed:false},
 {...base,attendance:'performed' as const,result:'approved' as const,courseUsed:false,simulationUsed:true,simulationContent:'much' as const,simulationFormat:null,simulationDifficulty:'unknown' as const},
 {...base,attendance:'absent' as const},base,
 ];
 const metrics=surveyMetrics(rows);
 const get=(label:string)=>metrics.find(row=>row.label===label);
 assert.deepEqual(get('Provas realizadas / tentativas'),{label:'Provas realizadas / tentativas',value:2,total:4});
 assert.equal(get('Resultados pendentes / provas realizadas')?.value,1);
 assert.equal(get('Curso: avaliações / usuários')?.value,0);
 assert.equal(get('Curso: avaliações / usuários')?.total,1);
 assert.equal(get('Simulados: formato avaliado / usuários')?.value,0);
 assert.equal(get('Simulados: dificuldade comparada / usuários')?.value,0);
 assert.equal(get('Simulados: não usaram / provas realizadas')?.value,1);
});

test('immediate test attempts do not enter regular indicators',()=>{
 const base=createSurvey('demo','test');
 const metrics=surveyMetrics([{...base,testMode:true,attendance:'performed',result:'approved'},base]);
 assert.equal(metrics[0].value,0);assert.equal(metrics[0].total,1);
});
