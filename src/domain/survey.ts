export type SurveyStep =
  | 'date'
  | 'confirm_date'
  | 'scheduled'
  | 'attendance'
  | 'result'
  | 'course_use'
  | 'course_alignment'
  | 'simulation_use'
  | 'simulation_content'
  | 'simulation_format'
  | 'simulation_difficulty'
  | 'comment'
  | 'done';

export type SurveyEvent =
  | { kind: 'text' | 'choice'; value: string }
  | { kind: 'followup' };

export type SurveyButton = { text: string; value: string };

export type Attendance = 'performed' | 'absent' | 'cancelled';
export type ExamResult = 'approved' | 'failed' | 'pending' | 'unknown';
export type Alignment = 'much' | 'partly' | 'little' | 'unknown';
export type SimulationDifficulty = 'easier' | 'same' | 'harder' | 'unknown';

export interface SurveyState {
  participantId: string;
  attemptId: string;
  revision: number;
  scheduleRevision: number;
  step: SurveyStep;
  examDate: string | null;
  candidateDate: string | null;
  dueAt: string | null;
  attendance: Attendance | null;
  result: ExamResult | null;
  paused: boolean;
  courseUsed: boolean | null;
  courseAlignment: Alignment | null;
  simulationUsed: boolean | null;
  simulationContent: Alignment | null;
  simulationFormat: Alignment | null;
  simulationDifficulty: SimulationDifficulty | null;
  comment: string | null;
  returnStep?: SurveyStep;
}

export interface SurveyResponse {
  state: SurveyState;
  message: string;
  buttons: SurveyButton[];
}

const TIME_ZONE = 'America/Fortaleza';
const DAY_MS = 86_400_000;

const DATE_BUTTONS: SurveyButton[] = [
  { text: 'Ainda não tenho data', value: 'unknown' },
  { text: 'Cancelar esta prova', value: 'no' },
];
const CONFIRM_DATE_BUTTONS: SurveyButton[] = [
  { text: 'Confirmar data', value: 'confirm' },
  { text: 'Corrigir data', value: 'no' },
];
const SCHEDULED_BUTTONS: SurveyButton[] = [
  { text: 'Informar ou remarcar data', value: '/data' },
  { text: 'Cancelar esta prova', value: '/cancelar' },
];
const ATTENDANCE_BUTTONS: SurveyButton[] = [
  { text: 'Realizei a prova', value: 'yes' },
  { text: 'Não compareci', value: 'no' },
  { text: 'Remarcar', value: '/data' },
  { text: 'Cancelar esta prova', value: '/cancelar' },
];
const RESULT_BUTTONS: SurveyButton[] = [
  { text: 'Aprovado', value: 'approved' },
  { text: 'Reprovado', value: 'failed' },
  { text: 'Aguardando resultado', value: 'pending' },
  { text: 'Não sei informar', value: 'unknown' },
];
const USE_BUTTONS: SurveyButton[] = [
  { text: 'Sim', value: 'yes' },
  { text: 'Não usei', value: 'no' },
];
const ALIGNMENT_BUTTONS: SurveyButton[] = [
  { text: 'Muito', value: 'much' },
  { text: 'Em parte', value: 'partly' },
  { text: 'Pouco', value: 'little' },
  { text: 'Não consigo avaliar', value: 'unknown' },
];
const DIFFICULTY_BUTTONS: SurveyButton[] = [
  { text: 'Mais fácil', value: 'easier' },
  { text: 'Semelhante', value: 'same' },
  { text: 'Mais difícil', value: 'harder' },
  { text: 'Não consigo comparar', value: 'unknown' },
];
const COMMENT_BUTTONS: SurveyButton[] = [
  { text: 'Pular comentário', value: 'skip' },
];

export function createSurvey(participantId: string, attemptId: string): SurveyState {
  return {
    participantId,
    attemptId,
    revision: 0,
    scheduleRevision: 0,
    step: 'date',
    examDate: null,
    candidateDate: null,
    dueAt: null,
    attendance: null,
    result: null,
    paused: false,
    courseUsed: null,
    courseAlignment: null,
    simulationUsed: null,
    simulationContent: null,
    simulationFormat: null,
    simulationDifficulty: null,
    comment: null,
  };
}

export function transition(
  state: SurveyState,
  event: SurveyEvent,
  now: Date,
): SurveyResponse {
  if (event.kind === 'followup') {
    return handleFollowup(state, now);
  }

  const value = event.value.trim();
  if (value.startsWith('/')) {
    return handleCommand(state, value.toLowerCase());
  }

  switch (state.step) {
    case 'date':
      return handleDate(state, event.kind, value, now);
    case 'confirm_date':
      return handleDateConfirmation(state, event.kind, value);
    case 'scheduled':
      return invalid(state, 'A prova está aguardando a data combinada. Use /data para alterar.');
    case 'attendance':
      return handleAttendance(state, event.kind, value);
    case 'result':
      return handleResult(state, event.kind, value);
    case 'course_use':
      return handleCourseUse(state, event.kind, value);
    case 'course_alignment':
      return handleAlignment(state, event.kind, value, 'simulation_use', 'courseAlignment');
    case 'simulation_use':
      return handleSimulationUse(state, event.kind, value);
    case 'simulation_content':
      return handleAlignment(state, event.kind, value, 'simulation_format', 'simulationContent');
    case 'simulation_format':
      return handleAlignment(
        state,
        event.kind,
        value,
        'simulation_difficulty',
        'simulationFormat',
      );
    case 'simulation_difficulty':
      return handleSimulationDifficulty(state, event.kind, value);
    case 'comment':
      return handleComment(state, event.kind, value);
    case 'done':
      return invalid(state, 'Esta pesquisa já foi encerrada. Use /resumo para consultar as respostas.');
  }
}

function handleCommand(state: SurveyState, command: string): SurveyResponse {
  switch (command) {
    case '/start':
      return renderStep(state);
    case '/resumo':
      return response(state, summary(state));
    case '/pausar': {
      if (state.paused) return response(state, 'Os contatos programados já estão pausados.');
      return response(
        update(state, { paused: true }),
        'Contatos programados pausados. Você ainda pode corrigir /data ou /resultado.',
      );
    }
    case '/retomar': {
      if (!state.paused) return response(state, 'Os contatos programados já estão ativos.');
      const resumed = update(state, { paused: false });
      const current = renderStep(resumed);
      return response(resumed, `Contatos retomados. ${current.message}`, current.buttons);
    }
    case '/data':
      return reopenDate(state);
    case '/cancelar':
      return cancelExam(state);
    case '/resultado':
      return reopenResult(state);
    default:
      return invalid(state, 'Comando não reconhecido. Use /start para continuar ou /resumo para consultar.');
  }
}

function reopenDate(state: SurveyState): SurveyResponse {
  if (state.attendance === 'performed') {
    return invalid(
      state,
      'Esta prova já foi realizada. Para outra prova, crie uma nova tentativa com /nova.',
    );
  }

  if (state.step === 'date' && state.examDate === null && state.dueAt === null) {
    return renderStep(state);
  }

  const reopened = update(state, {
    step: 'date',
    examDate: null,
    candidateDate: null,
    dueAt: null,
    attendance: null,
    scheduleRevision: state.scheduleRevision + 1,
    returnStep: undefined,
  });
  return response(reopened, 'Informe a nova data da prova no formato AAAA-MM-DD.', DATE_BUTTONS);
}

function cancelExam(state: SurveyState): SurveyResponse {
  if (state.attendance === 'performed') {
    return invalid(
      state,
      'Esta prova já foi realizada. Para outra prova, crie uma nova tentativa com /nova.',
    );
  }

  const cancelled = update(state, {
    step: 'done',
    examDate: null,
    candidateDate: null,
    dueAt: null,
    attendance: 'cancelled',
    result: null,
    courseUsed: null,
    courseAlignment: null,
    simulationUsed: null,
    simulationContent: null,
    simulationFormat: null,
    simulationDifficulty: null,
    comment: null,
    scheduleRevision: state.scheduleRevision + 1,
    returnStep: undefined,
  });
  return response(cancelled, 'Prova cancelada. Nenhuma avaliação será solicitada.');
}

function reopenResult(state: SurveyState): SurveyResponse {
  if (state.attendance !== 'performed') {
    return invalid(state, 'O resultado só pode ser informado depois de uma prova realizada.');
  }
  if (state.step === 'result') return renderStep(state);

  const reopened = update(state, { step: 'result', returnStep: state.step });
  return response(reopened, 'Qual é o resultado correto?', RESULT_BUTTONS);
}

function handleDate(
  state: SurveyState,
  kind: 'text' | 'choice',
  value: string,
  now: Date,
): SurveyResponse {
  if (kind === 'choice') {
    if (value === 'unknown') {
      const undated = update(state, {
        step: 'scheduled',
        examDate: null,
        candidateDate: null,
        dueAt: null,
        attendance: null,
      });
      return response(
        undated,
        'Tentativa registrada sem data. Nenhum contato foi programado; use /data quando souber.',
        SCHEDULED_BUTTONS,
      );
    }
    if (value === 'no') return cancelExam(state);
    return invalidChoice(state);
  }

  if (!isAllowedExamDate(value, now)) {
    return invalid(
      state,
      'Informe uma data válida no formato AAAA-MM-DD, de hoje até 730 dias no futuro.',
      DATE_BUTTONS,
    );
  }

  const proposed = update(state, { step: 'confirm_date', candidateDate: value });
  return response(proposed, `Confirma a prova em ${value}?`, CONFIRM_DATE_BUTTONS);
}

function handleDateConfirmation(
  state: SurveyState,
  kind: 'text' | 'choice',
  value: string,
): SurveyResponse {
  if (kind !== 'choice') return invalidChoice(state, CONFIRM_DATE_BUTTONS);
  if (value === 'no') {
    const correcting = update(state, { step: 'date', candidateDate: null });
    return response(correcting, 'Informe a data correta no formato AAAA-MM-DD.', DATE_BUTTONS);
  }
  if (value !== 'confirm' || state.candidateDate === null) {
    return invalidChoice(state, CONFIRM_DATE_BUTTONS);
  }

  const examDate = state.candidateDate;
  const scheduled = update(state, {
    step: 'scheduled',
    examDate,
    candidateDate: null,
    dueAt: dueAtForExamDate(examDate),
    attendance: null,
    scheduleRevision: state.scheduleRevision + 1,
  });
  return response(
    scheduled,
    `Data confirmada. O contato está previsto para ${scheduled.dueAt}.`,
    SCHEDULED_BUTTONS,
  );
}

function handleFollowup(state: SurveyState, now: Date): SurveyResponse {
  if (state.paused) {
    return response(state, 'Os contatos programados estão pausados. Use /retomar para continuar.');
  }
  if (state.step !== 'scheduled') return renderStep(state);
  if (state.dueAt === null) {
    return response(
      state,
      'A tentativa continua sem data e sem contato programado. Use /data quando souber.',
      SCHEDULED_BUTTONS,
    );
  }
  if (now.getTime() < Date.parse(state.dueAt)) {
    return response(state, `O contato ainda não venceu. Está previsto para ${state.dueAt}.`);
  }

  const asking = update(state, { step: 'attendance' });
  return response(asking, 'Você realizou a prova prevista?', ATTENDANCE_BUTTONS);
}

function handleAttendance(
  state: SurveyState,
  kind: 'text' | 'choice',
  value: string,
): SurveyResponse {
  if (kind !== 'choice') return invalidChoice(state, ATTENDANCE_BUTTONS);
  if (value === 'yes') {
    const performed = update(state, { step: 'result', attendance: 'performed' });
    return response(performed, 'Qual foi o resultado?', RESULT_BUTTONS);
  }
  if (value === 'no') {
    const absent = update(state, {
      step: 'done',
      attendance: 'absent',
      result: null,
      courseUsed: null,
      courseAlignment: null,
      simulationUsed: null,
      simulationContent: null,
      simulationFormat: null,
      simulationDifficulty: null,
      comment: null,
    });
    return response(absent, 'Ausência registrada. Nenhuma avaliação será solicitada.');
  }
  return invalidChoice(state, ATTENDANCE_BUTTONS);
}

function handleResult(
  state: SurveyState,
  kind: 'text' | 'choice',
  value: string,
): SurveyResponse {
  const allowed: ExamResult[] = ['approved', 'failed', 'pending', 'unknown'];
  if (kind !== 'choice' || !allowed.includes(value as ExamResult)) {
    return invalidChoice(state, RESULT_BUTTONS);
  }

  const result = value as ExamResult;
  if (state.returnStep !== undefined) {
    const returnStep = state.returnStep;
    const corrected = update(state, { result, step: returnStep, returnStep: undefined });
    const current = renderStep(corrected);
    return response(corrected, `Resultado corrigido. ${current.message}`, current.buttons);
  }

  const answered = update(state, { result, step: 'course_use' });
  const prefix = result === 'approved'
    ? 'Parabéns pela aprovação. '
    : result === 'failed'
      ? 'Obrigado por compartilhar. '
      : '';
  return response(answered, `${prefix}Você utilizou o curso para se preparar?`, USE_BUTTONS);
}

function handleCourseUse(
  state: SurveyState,
  kind: 'text' | 'choice',
  value: string,
): SurveyResponse {
  if (kind !== 'choice' || (value !== 'yes' && value !== 'no')) {
    return invalidChoice(state, USE_BUTTONS);
  }
  if (value === 'yes') {
    const used = update(state, { step: 'course_alignment', courseUsed: true });
    return response(
      used,
      'Quanto o conteúdo do curso correspondeu ao cobrado?',
      ALIGNMENT_BUTTONS,
    );
  }

  const unused = update(state, {
    step: 'simulation_use',
    courseUsed: false,
    courseAlignment: null,
  });
  return response(unused, 'Você utilizou os simulados?', USE_BUTTONS);
}

function handleAlignment(
  state: SurveyState,
  kind: 'text' | 'choice',
  value: string,
  nextStep: SurveyStep,
  field: 'courseAlignment' | 'simulationContent' | 'simulationFormat',
): SurveyResponse {
  const allowed: Alignment[] = ['much', 'partly', 'little', 'unknown'];
  if (kind !== 'choice' || !allowed.includes(value as Alignment)) {
    return invalidChoice(state, ALIGNMENT_BUTTONS);
  }

  const answered = update(state, { [field]: value as Alignment, step: nextStep });
  if (nextStep === 'simulation_use') {
    return response(answered, 'Você utilizou os simulados?', USE_BUTTONS);
  }
  if (nextStep === 'simulation_format') {
    return response(
      answered,
      'Quanto o formato das questões dos simulados se pareceu com a prova?',
      ALIGNMENT_BUTTONS,
    );
  }
  return response(
    answered,
    'A prova foi mais fácil, semelhante ou mais difícil que os simulados?',
    DIFFICULTY_BUTTONS,
  );
}

function handleSimulationUse(
  state: SurveyState,
  kind: 'text' | 'choice',
  value: string,
): SurveyResponse {
  if (kind !== 'choice' || (value !== 'yes' && value !== 'no')) {
    return invalidChoice(state, USE_BUTTONS);
  }
  if (value === 'yes') {
    const used = update(state, { step: 'simulation_content', simulationUsed: true });
    return response(
      used,
      'Quanto os assuntos dos simulados corresponderam ao cobrado?',
      ALIGNMENT_BUTTONS,
    );
  }

  const unused = update(state, {
    step: 'comment',
    simulationUsed: false,
    simulationContent: null,
    simulationFormat: null,
    simulationDifficulty: null,
  });
  return response(unused, 'Deseja deixar um comentário opcional?', COMMENT_BUTTONS);
}

function handleSimulationDifficulty(
  state: SurveyState,
  kind: 'text' | 'choice',
  value: string,
): SurveyResponse {
  const allowed: SimulationDifficulty[] = ['easier', 'same', 'harder', 'unknown'];
  if (kind !== 'choice' || !allowed.includes(value as SimulationDifficulty)) {
    return invalidChoice(state, DIFFICULTY_BUTTONS);
  }
  const answered = update(state, {
    step: 'comment',
    simulationDifficulty: value as SimulationDifficulty,
  });
  return response(answered, 'Deseja deixar um comentário opcional?', COMMENT_BUTTONS);
}

function handleComment(
  state: SurveyState,
  kind: 'text' | 'choice',
  value: string,
): SurveyResponse {
  if (kind === 'choice') {
    if (value !== 'skip') return invalidChoice(state, COMMENT_BUTTONS);
    return response(update(state, { step: 'done', comment: null }), 'Respostas registradas. Obrigado!');
  }

  if (value.length === 0) {
    return invalid(state, 'Escreva um comentário ou escolha pular.', COMMENT_BUTTONS);
  }
  if (value.length > 1000) {
    return invalid(state, 'O comentário deve ter no máximo 1000 caracteres.', COMMENT_BUTTONS);
  }
  return response(update(state, { step: 'done', comment: value }), 'Respostas registradas. Obrigado!');
}

function renderStep(state: SurveyState): SurveyResponse {
  switch (state.step) {
    case 'date':
      return response(
        state,
        'Informe a data da prova no formato AAAA-MM-DD.',
        DATE_BUTTONS,
      );
    case 'confirm_date':
      return response(
        state,
        `Confirma a prova em ${state.candidateDate ?? 'data não informada'}?`,
        CONFIRM_DATE_BUTTONS,
      );
    case 'scheduled':
      return state.dueAt === null
        ? response(
            state,
            'Tentativa sem data e sem contato programado. Use /data quando souber.',
            SCHEDULED_BUTTONS,
          )
        : response(state, `Prova agendada para ${state.examDate}.`, SCHEDULED_BUTTONS);
    case 'attendance':
      return response(state, 'Você realizou a prova prevista?', ATTENDANCE_BUTTONS);
    case 'result':
      return response(state, 'Qual foi o resultado?', RESULT_BUTTONS);
    case 'course_use':
      return response(state, 'Você utilizou o curso para se preparar?', USE_BUTTONS);
    case 'course_alignment':
      return response(
        state,
        'Quanto o conteúdo do curso correspondeu ao cobrado?',
        ALIGNMENT_BUTTONS,
      );
    case 'simulation_use':
      return response(state, 'Você utilizou os simulados?', USE_BUTTONS);
    case 'simulation_content':
      return response(
        state,
        'Quanto os assuntos dos simulados corresponderam ao cobrado?',
        ALIGNMENT_BUTTONS,
      );
    case 'simulation_format':
      return response(
        state,
        'Quanto o formato das questões dos simulados se pareceu com a prova?',
        ALIGNMENT_BUTTONS,
      );
    case 'simulation_difficulty':
      return response(
        state,
        'A prova foi mais fácil, semelhante ou mais difícil que os simulados?',
        DIFFICULTY_BUTTONS,
      );
    case 'comment':
      return response(state, 'Deseja deixar um comentário opcional?', COMMENT_BUTTONS);
    case 'done':
      return response(state, `Pesquisa encerrada. ${summary(state)}`);
  }
}

function summary(state: SurveyState): string {
  const attendance = state.attendance === 'performed'
    ? 'realizada'
    : state.attendance === 'absent'
      ? 'ausência'
      : state.attendance === 'cancelled'
        ? 'cancelada'
        : 'não informada';
  return [
    `Data: ${state.examDate ?? 'sem data'}`,
    `Situação: ${attendance}`,
    `Resultado: ${state.result ?? 'não informado'}`,
    `Curso: ${state.courseUsed === null ? 'não informado' : state.courseUsed ? 'usou' : 'não usou'}`,
    `Simulados: ${state.simulationUsed === null ? 'não informado' : state.simulationUsed ? 'usou' : 'não usou'}`,
  ].join(' · ');
}

function response(
  state: SurveyState,
  message: string,
  buttons: SurveyButton[] = [],
): SurveyResponse {
  return { state, message, buttons: buttons.map((button) => ({ ...button })) };
}

function invalid(
  state: SurveyState,
  message: string,
  buttons: SurveyButton[] = [],
): SurveyResponse {
  return response(state, message, buttons);
}

function invalidChoice(
  state: SurveyState,
  buttons: SurveyButton[] = [],
): SurveyResponse {
  return invalid(state, 'Escolha uma opção disponível.', buttons);
}

function update(state: SurveyState, patch: Partial<SurveyState>): SurveyState {
  return { ...state, ...patch, revision: state.revision + 1 };
}

function isAllowedExamDate(value: string, now: Date): boolean {
  const candidate = parseCivilDate(value);
  if (candidate === null || !Number.isFinite(now.getTime())) return false;

  const today = civilDateInTimeZone(now);
  const candidateDay = civilDay(candidate.year, candidate.month, candidate.day);
  const todayDay = civilDay(today.year, today.month, today.day);
  const difference = candidateDay - todayDay;
  return difference >= 0 && difference <= 730;
}

function parseCivilDate(
  value: string,
): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function civilDateInTimeZone(date: Date): { year: number; month: number; day: number } {
  const parts = dateParts(date, false);
  return { year: parts.year, month: parts.month, day: parts.day };
}

function dueAtForExamDate(examDate: string): string {
  const parsed = parseCivilDate(examDate);
  if (parsed === null) throw new Error('invalid confirmed exam date');

  const nextDay = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + 1));
  const target = {
    year: nextDay.getUTCFullYear(),
    month: nextDay.getUTCMonth() + 1,
    day: nextDay.getUTCDate(),
    hour: 10,
    minute: 0,
    second: 0,
  };
  const targetAsUtc = Date.UTC(
    target.year,
    target.month - 1,
    target.day,
    target.hour,
    target.minute,
    target.second,
  );

  let instant = targetAsUtc;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const zoned = dateParts(new Date(instant), true);
    const zonedAsUtc = Date.UTC(
      zoned.year,
      zoned.month - 1,
      zoned.day,
      zoned.hour,
      zoned.minute,
      zoned.second,
    );
    const nextInstant = targetAsUtc - (zonedAsUtc - instant);
    if (nextInstant === instant) break;
    instant = nextInstant;
  }

  const verified = dateParts(new Date(instant), true);
  if (
    verified.year !== target.year
    || verified.month !== target.month
    || verified.day !== target.day
    || verified.hour !== target.hour
    || verified.minute !== 0
  ) {
    throw new Error(`cannot resolve 10:00 in ${TIME_ZONE}`);
  }
  return new Date(instant).toISOString();
}

function dateParts(
  date: Date,
  includeTime: boolean,
): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(includeTime
      ? {
          hour: '2-digit' as const,
          minute: '2-digit' as const,
          second: '2-digit' as const,
          hourCycle: 'h23' as const,
        }
      : {}),
  });
  const values = new Map(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: values.get('year')!,
    month: values.get('month')!,
    day: values.get('day')!,
    hour: values.get('hour') ?? 0,
    minute: values.get('minute') ?? 0,
    second: values.get('second') ?? 0,
  };
}

function civilDay(year: number, month: number, day: number): number {
  return Date.UTC(year, month - 1, day) / DAY_MS;
}
