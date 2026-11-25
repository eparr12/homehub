// Stands in for docker in update.test.ts. Node runs this file as the program
// that update.ps1 calls, so to the script it has a real stdout, stderr and
// exit code. It answers each command line from the plan that the test wrote,
// call by call, and appends every call, with the folder it ran in, to a file
// that the test reads back.
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { z } from 'zod';

const answerSchema = z.object({
  stdout: z.string().default(''),
  stderr: z.string().default(''),
  exitCode: z.number().int().default(0),
});

const planSchema = z.record(z.string(), z.array(answerSchema));

/**
 * Each docker command line's answers, in call order; the last one repeats.
 * update.test.ts imports only this type: importing anything else would run
 * the fake in the test's own process.
 */
export type Plan = z.input<typeof planSchema>;

type Answer = z.infer<typeof answerSchema>;

// Each line of the calls file is the folder, a tab, then the command line.
const CALL_SEPARATOR = '\t';

// What a command that the plan doesn't name exits with. It's still recorded,
// so the test's list of commands shows it.
const UNPLANNED_EXIT_CODE = 99;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined) throw new Error(`fake docker needs ${name}`);
  return value;
}

function countEarlierCalls(callsFile: string, command: string): number {
  if (!existsSync(callsFile)) return 0;
  return readFileSync(callsFile, 'utf8')
    .split('\n')
    .filter((line) => line.endsWith(`${CALL_SEPARATOR}${command}`)).length;
}

function answerFor(
  plan: z.infer<typeof planSchema>,
  command: string,
  callNumber: number,
): Answer | undefined {
  const answers = plan[command] ?? [];
  return answers[Math.min(callNumber, answers.length - 1)];
}

const callsFile = requiredEnv('FAKE_DOCKER_CALLS');
const plan = planSchema.parse(
  JSON.parse(readFileSync(requiredEnv('FAKE_DOCKER_PLAN'), 'utf8')),
);
const command = process.argv.slice(2).join(' ');
const answer = answerFor(plan, command, countEarlierCalls(callsFile, command));
appendFileSync(callsFile, `${process.cwd()}${CALL_SEPARATOR}${command}\n`);

if (answer === undefined) {
  process.stderr.write(`fake docker has no answer for: docker ${command}\n`);
  process.exitCode = UNPLANNED_EXIT_CODE;
} else {
  process.stdout.write(answer.stdout);
  process.stderr.write(answer.stderr);
  process.exitCode = answer.exitCode;
}
