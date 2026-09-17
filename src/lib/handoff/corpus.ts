import type { Verdict } from "./types";

export type CorpusFramework =
  | "github"
  | "crewai"
  | "langgraph"
  | "microsoft"
  | "stripe"
  | "autre";

export interface CorpusCase {
  id: string;
  framework: CorpusFramework;
  title: string;
  url: string;
  retrieved: string;
  excerpt: string;
  facts: string[];
  adapter: string;
  payload: unknown;
  expected: Verdict;
  rationale: string;
}

const RET = "2026-09-16";
const T_CI = "2024-01-16T00:00:00Z";
const T_GH = "2018-05-04T01:14:52Z";
const T_VS = "2026-04-20T12:00:00Z";
const T_MS = "2026-05-08T00:00:00Z";
const T_ST = "2023-04-06T16:21:44Z";

function ev(
  id: string,
  type: string,
  source: string,
  timestamp: string,
  status: string,
  content: unknown,
) {
  return { id, type, source, timestamp, status, content };
}

export const CORPUS_CASES: CorpusCase[] = [
  {
    id: "X01",
    framework: "github",
    title: "pytest CI · assertion de date",
    url: "https://docs.github.com/en/copilot/tutorials/copilot-cookbook/debug-errors/diagnose-ci-test-failures",
    retrieved: RET,
    excerpt: `___ TestOrderService.test_order_created_today ___
>       assert order["created_date"] == date.today()
E       AssertionError: assert datetime.date(2024, 1, 15) == datetime.date(2024, 1, 16)
test_order_service.py:45: AssertionError`,
    facts: [
      "Job pytest : TestOrderService.test_order_created_today",
      "AssertionError : date(2024, 1, 15) == date(2024, 1, 16)",
      "Fichier : test_order_service.py ligne 45",
    ],
    adapter: "AssertionError du journal → evidence.status FAIL.",
    expected: "CORROMPU",
    rationale: "L'agent affirme que les tests ont réussi. Le journal dit AssertionError.",
    payload: {
      from: "ci_collector",
      to: "fixer",
      task: "Stabiliser test_order_created_today",
      state: { known: { file: "test_order_service.py", line: 45 }, version: "1" },
      work_done: [{ claim: "Les tests ont réussi.", evidence_refs: ["log1"] }],
      work_remaining: ["Corriger le calcul de date"],
      evidence: [
        ev("log1", "tool_result", "github-actions", T_CI, "FAIL", {
          test: "TestOrderService.test_order_created_today",
          assertion: "datetime.date(2024, 1, 15) == datetime.date(2024, 1, 16)",
        }),
      ],
    },
  },
  {
    id: "X02",
    framework: "github",
    title: "pytest CI · journal transmis",
    url: "https://docs.github.com/en/copilot/tutorials/copilot-cookbook/debug-errors/diagnose-ci-test-failures",
    retrieved: RET,
    excerpt: `My CI is failing on this branch. Can you pull the latest workflow run
logs, figure out what is failing, and help me fix it? The relevant files
are @order.py and @test_order_service.py`,
    facts: [
      "Demande : extraire le journal du dernier workflow",
      "Fichiers cités : order.py, test_order_service.py",
      "Journal pytest présent avec AssertionError",
    ],
    adapter: "Le journal est une pièce. L'affirmation ne porte que sur la collecte.",
    expected: "REPRENABLE",
    rationale: "Le suivant voit le journal FAIL et le reste à faire. Rien n'est inventé.",
    payload: {
      from: "copilot_cli",
      to: "fixer",
      task: "Relire le journal CI de test_order_service",
      state: { known: { files: ["order.py", "test_order_service.py"] }, version: "1" },
      work_done: [{ claim: "Le journal CI a été collecté.", evidence_refs: ["log1"] }],
      work_remaining: ["Corriger le calcul de date"],
      evidence: [
        ev("log1", "tool_result", "github-mcp", T_CI, "FAIL", {
          test: "TestOrderService.test_order_created_today",
          assertion: "datetime.date(2024, 1, 15) == datetime.date(2024, 1, 16)",
        }),
      ],
      uncertainties: ["Je ne sais pas si le décalage vient du fuseau du runner."],
    },
  },
  {
    id: "X03",
    framework: "github",
    title: "Check run · mighty_readme",
    url: "https://docs.github.com/en/rest/checks/runs",
    retrieved: RET,
    excerpt: `{
  "name": "mighty_readme",
  "html_url": "https://github.com/github/hello-world/runs/4",
  "status": "completed",
  "conclusion": "success",
  "completed_at": "2018-05-04T01:14:52Z"
}`,
    facts: [
      "check_run name=mighty_readme",
      "status=completed, conclusion=success",
      "html_url=https://github.com/github/hello-world/runs/4",
      "completed_at=2018-05-04T01:14:52Z",
    ],
    adapter: "conclusion success → evidence.status PASS.",
    expected: "REPRENABLE",
    rationale: "Pièce GitHub sourcée, horodatée, liée. La revue reste à faire.",
    payload: {
      from: "checks_api",
      to: "reviewer",
      task: "Lire le check mighty_readme",
      state: { known: { repo: "github/hello-world", run: 4 }, version: "1" },
      work_done: [{ claim: "La vérification a été effectuée.", evidence_refs: ["cr1"] }],
      work_remaining: ["Lire le rapport du check"],
      evidence: [
        ev("cr1", "tool_result", "github-checks", T_GH, "PASS", {
          name: "mighty_readme",
          conclusion: "success",
          html_url: "https://github.com/github/hello-world/runs/4",
        }),
      ],
    },
  },
  {
    id: "X04",
    framework: "github",
    title: "Check run · conclusion cancelled",
    url: "https://docs.github.com/en/rest/checks/runs",
    retrieved: RET,
    excerpt: `If the status is completed, the conclusion can be any of the following:
action_required, cancelled, timed_out, failure, neutral, skipped, stale, startup_failure, success.`,
    facts: [
      "Check run completed",
      "conclusion=cancelled",
      "name=mighty_readme, run id=4",
    ],
    adapter: "conclusion cancelled → evidence.status CANCELLED.",
    expected: "CORROMPU",
    rationale: "L'affirmation dit réussi. La pièce dit cancelled.",
    payload: {
      from: "checks_api",
      to: "reviewer",
      task: "Lire le check mighty_readme",
      state: { known: { repo: "github/hello-world", run: 4 }, version: "1" },
      work_done: [{ claim: "La vérification a réussi.", evidence_refs: ["cr1"] }],
      work_remaining: ["Relancer le check"],
      evidence: [
        ev("cr1", "tool_result", "github-checks", T_GH, "CANCELLED", {
          name: "mighty_readme",
          conclusion: "cancelled",
        }),
      ],
    },
  },
  {
    id: "X05",
    framework: "github",
    title: "Copilot push · Actions non exécutées",
    url: "https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/troubleshoot-cloud-agent",
    retrieved: RET,
    excerpt: `GitHub Actions workflows will not run automatically when Copilot pushes changes to a pull request. To allow GitHub Actions workflows to run, click the Approve and run workflows button in the pull request's merge box.`,
    facts: [
      "Copilot a poussé des changements sur une PR",
      "Les workflows Actions ne démarrent pas automatiquement",
      "Un bouton Approve and run workflows est requis",
    ],
    adapter: "Aucun check_run n'est joint. Rien n'est inventé.",
    expected: "PARTIEL",
    rationale: "Les contrôles sont affirmés. Aucune pièce de check n'est là.",
    payload: {
      from: "copilot_agent",
      to: "maintainer",
      task: "Valider la PR après poussée Copilot",
      state: { known: { event: "copilot_push" }, version: "1" },
      work_done: [{ claim: "Les contrôles ont été confirmés.", evidence_refs: [] }],
      work_remaining: ["Approuver l'exécution des workflows"],
      evidence: [],
    },
  },
  {
    id: "X06",
    framework: "github",
    title: "PR · conflits encore présents",
    url: "https://github.com/orgs/community/discussions/189621",
    retrieved: RET,
    excerpt: `Over and over and over again, I have merge conflicts in a PR, and I tell the copilot agent to find the merge conflicts and fix them. It does "stuff" for a while, and then claims victory. Meanwhile it never found the merge conflicts.`,
    facts: [
      "PR avec conflits de fusion",
      "L'agent a travaillé un moment",
      "Les marqueurs de conflit sont encore dans la branche",
    ],
    adapter: "Aucune pièce git n'est jointe. L'affirmation reste nue.",
    expected: "PARTIEL",
    rationale: "« Victoire » sans git status ni diff. Le suivant doit reconstruire.",
    payload: {
      from: "copilot_pr",
      to: "reviewer",
      task: "Résoudre les conflits de la PR",
      state: { known: { has_conflicts: true }, version: "1" },
      work_done: [{ claim: "Les conflits ont été résolus.", evidence_refs: [] }],
      work_remaining: ["Vérifier git status"],
      evidence: [],
    },
  },
  {
    id: "X07",
    framework: "github",
    title: "VS Code · bascule de mode",
    url: "https://github.com/microsoft/vscode/issues/311420",
    retrieved: RET,
    excerpt: `"switchEvidence": {
  "switchAgentObservedInSessionLog": false,
  "executorModeObservedAfterHandoff": false
}
"sourcePlannerModeStillPresentAfterHandoff": true`,
    facts: [
      "switchAgentObservedInSessionLog = false",
      "executorModeObservedAfterHandoff = false",
      "sourcePlannerModeStillPresentAfterHandoff = true",
    ],
    adapter: "Booléens copiés tels quels. Pas de mapping vers FAIL.",
    expected: "CORROMPU",
    rationale: "L'affirmation dit que le mode exécuteur est confirmé. Les booléens disent le contraire.",
    payload: {
      from: "planner",
      to: "executor",
      task: "Passer en mode exécuteur après le plan",
      state: { known: { issue: "311420" }, version: "1" },
      work_done: [{ claim: "Le mode exécuteur a été confirmé.", evidence_refs: ["sess1"] }],
      work_remaining: ["Exécuter le plan"],
      evidence: [
        ev("sess1", "document", "vscode-session", T_VS, "", {
          switchAgentObservedInSessionLog: false,
          executorModeObservedAfterHandoff: false,
          sourcePlannerModeStillPresentAfterHandoff: true,
        }),
      ],
    },
  },
  {
    id: "X08",
    framework: "crewai",
    title: "Research → Write · context seul",
    url: "https://docs.crewai.com/en/concepts/collaboration",
    retrieved: RET,
    excerpt: `writing_task = Task(
    description="Write an article based on the research findings",
    expected_output="Engaging 800-word article about quantum computing",
    agent=writer,
    context=[research_task]  # Gets research output as context
)`,
    facts: [
      "writer reçoit context=[research_task]",
      "expected_output est une spécification, pas un artefact",
      "Aucun hash, aucun tool_result",
    ],
    adapter: "Le pointeur de contexte n'est pas une preuve.",
    expected: "PARTIEL",
    rationale: "Le rédacteur hérite d'une tâche, pas d'une pièce vérifiable.",
    payload: {
      from: "researcher",
      to: "writer",
      task: "Écrire l'article à partir de la recherche",
      state: { known: { topic: "quantum computing" }, version: "1" },
      work_done: [{ claim: "La recherche a été terminée.", evidence_refs: [] }],
      work_remaining: ["Rédiger 800 mots"],
      evidence: [],
    },
  },
  {
    id: "X09",
    framework: "crewai",
    title: "expected_output pris pour preuve",
    url: "https://docs.crewai.com/en/concepts/collaboration",
    retrieved: RET,
    excerpt: `research_task = Task(
    description="Research the latest developments in quantum computing",
    expected_output="Comprehensive research summary with key findings and sources",
    agent=researcher
)`,
    facts: [
      "expected_output décrit le livrable souhaité",
      "Aucune sortie réelle n'est jointe",
    ],
    adapter: "expected_output copié dans evidence.content — c'est encore une spec.",
    expected: "PARTIEL",
    rationale: "Une spécification n'atteste pas que le travail a eu lieu.",
    payload: {
      from: "researcher",
      to: "writer",
      task: "Rechercher les développements en calcul quantique",
      state: { known: { topic: "quantum computing" }, version: "1" },
      work_done: [{ claim: "Le résumé a été produit.", evidence_refs: ["spec1"] }],
      work_remaining: ["Rédiger l'article"],
      evidence: [
        ev("spec1", "document", "crewai-task", T_MS, "", {
          expected_output: "Comprehensive research summary with key findings and sources",
        }),
      ],
    },
  },
  {
    id: "X10",
    framework: "crewai",
    title: "output_file sans empreinte",
    url: "https://raw.githubusercontent.com/crewaiinc/skills/main/skills/getting-started/SKILL.md",
    retrieved: RET,
    excerpt: `return Task(
    config=self.tasks_config["reporting_task"],
    context=[self.research_task()],
    output_file="output/report.md",
)`,
    facts: [
      "output_file = output/report.md",
      "Aucun contenu, aucun hash, aucun statut d'écriture",
    ],
    adapter: "Le chemin est joint comme pièce. Rien d'autre n'existe dans la source.",
    expected: "PARTIEL",
    rationale: "Un chemin n'établit pas que le fichier contient le rapport.",
    payload: {
      from: "reporting_analyst",
      to: "publisher",
      task: "Produire le rapport",
      state: { known: { output_file: "output/report.md" }, version: "1" },
      work_done: [{ claim: "Le rapport a été écrit.", evidence_refs: ["f1"] }],
      work_remaining: ["Publier le rapport"],
      evidence: [
        ev("f1", "document", "crewai", T_MS, "", { path: "output/report.md" }),
      ],
    },
  },
  {
    id: "X11",
    framework: "langgraph",
    title: "Command goto · état minimal",
    url: "https://langchain-ai.github.io/langgraph/how-tos/agent-handoffs/",
    retrieved: RET,
    excerpt: `return Command(
    goto=goto,
    update={"my_state_key": "my_state_value"}
)`,
    facts: [
      "goto pointe vers un autre agent",
      "update contient my_state_key=my_state_value",
      "Le travail restant n'est pas décrit",
    ],
    adapter: "Enveloppe LangGraph conservée. Pas de remaining dans la source.",
    expected: "PARTIEL",
    rationale: "Le suivant reçoit une clé d'état, pas de reste de travail.",
    payload: {
      next: "bob",
      state: { my_state_key: "my_state_value" },
      handoff: {
        from: "alice",
        to: "bob",
        task: "Continuer après transfert",
        state: { known: { my_state_key: "my_state_value" }, version: "1" },
        work_done: [{ claim: "Le contrôle a été transféré.", evidence_refs: [] }],
        evidence: [],
      },
    },
  },
  {
    id: "X12",
    framework: "langgraph",
    title: "interrupt · pas de reprise",
    url: "https://docs.langchain.com/oss/javascript/langgraph/interrupts",
    retrieved: RET,
    excerpt: `async function approvalNode(state: State) {
    const approved = interrupt("Do you approve this action?");
`,
    facts: [
      "interrupt payload = Do you approve this action?",
      "Aucune valeur de resume n'est présente",
    ],
    adapter: "L'interrupt est un arrêt, pas une preuve d'approbation.",
    expected: "PARTIEL",
    rationale: "L'approbation est affirmée. La pièce n'est que la question.",
    payload: {
      from: "approval_node",
      to: "executor",
      task: "Obtenir une approbation",
      state: { known: { interrupt: "Do you approve this action?" }, version: "1" },
      work_done: [{ claim: "L'approbation a été confirmée.", evidence_refs: [] }],
      work_remaining: ["Reprendre le graphe"],
      evidence: [],
    },
  },
  {
    id: "X13",
    framework: "langgraph",
    title: "Command.PARENT · pas d'atome",
    url: "https://github.com/langchain-ai/langgraph/issues/6455",
    retrieved: RET,
    excerpt: `It is currently not possible in Python LangGraph to perform a single atomic handoff from a subgraph to another graph that:
1. Updates the current graph's state
2. Jumps to a different graph
3. Applies updates in the new graph
4. Guarantees the output history is LLM-valid`,
    facts: [
      "Command.PARENT applique update sur le graphe parent",
      "goto vise un nœud d'un autre graphe",
      "La mise à jour locale n'est pas garantie dans la même opération",
    ],
    adapter: "Faits structurels. Pas de diagnostic collé dans le paquet.",
    expected: "PARTIEL",
    rationale: "La mise à jour locale est affirmée. Aucune pièce locale n'est jointe.",
    payload: {
      from: "subgraph",
      to: "parent",
      task: "Appliquer l'update puis changer de graphe",
      state: { known: { graph: "PARENT", goto: "LLM2" }, version: "1" },
      work_done: [{ claim: "La mise à jour locale a été effectuée.", evidence_refs: [] }],
      work_remaining: ["Entrer dans LLM2"],
      evidence: [],
    },
  },
  {
    id: "X14",
    framework: "microsoft",
    title: "refund_agent · promesse",
    url: "https://learn.microsoft.com/en-us/agent-framework/user-guide/workflows/orchestrations/handoff",
    retrieved: RET,
    excerpt: `refund_agent: I'll process your refund for order 1234. Here's what will happen next:
1. Verification of the damaged items
2. Refund request submission
3. Return instructions if needed
4. Refund processing within 5-10 business days`,
    facts: [
      "order_id = 1234",
      "refund_agent annonce un traitement",
      "Aucune transaction, aucun identifiant de remboursement",
    ],
    adapter: "Le dialogue est du texte d'agent, pas un reçu.",
    expected: "PARTIEL",
    rationale: "Le remboursement est annoncé. Il n'est pas prouvé.",
    payload: {
      from: "refund_agent",
      to: "customer_ops",
      task: "Traiter le remboursement de la commande 1234",
      state: { known: { order_id: "1234" }, version: "1" },
      work_done: [{ claim: "Le remboursement a été versé.", evidence_refs: [] }],
      work_remaining: ["Vérifier les articles endommagés"],
      evidence: [],
    },
  },
  {
    id: "X15",
    framework: "microsoft",
    title: "HandoffBuilder · topologie seule",
    url: "https://learn.microsoft.com/en-us/agent-framework/user-guide/workflows/orchestrations/handoff",
    retrieved: RET,
    excerpt: `workflow = (
    HandoffBuilder(
        name="customer_support_handoff",
        participants=[triage_agent, refund_agent, order_agent, return_agent],
    )
    .with_start_agent(triage_agent)
    .add_handoff(triage_agent, [order_agent, return_agent])
    .build()
)`,
    facts: [
      "participants : triage, refund, order, return",
      "start = triage_agent",
      "Aucune conversation, aucun outil",
    ],
    adapter: "La topologie n'est pas un paquet de travail.",
    expected: "PARTIEL",
    rationale: "Rien n'a encore été fait. Il n'y a rien à reprendre.",
    payload: {
      from: "triage_agent",
      to: "order_agent",
      task: "",
      work_done: [],
      work_remaining: ["Recevoir le premier message"],
      evidence: [],
    },
  },
  {
    id: "X16",
    framework: "microsoft",
    title: "Magentic · ledger texte",
    url: "https://learn.microsoft.com/en-us/agent-framework/user-guide/workflows/orchestrations/magentic",
    retrieved: RET,
    excerpt: `The manager (planner) never inspects internal tool state; it only reads what the orchestrator records in the shared chat history.`,
    facts: [
      "Le manager ne lit pas l'état interne des outils",
      "Il lit l'historique de chat partagé",
      "Aucun tool_result n'est joint",
    ],
    adapter: "Le ledger textuel est joint. Ce n'est pas un tool_result.",
    expected: "PARTIEL",
    rationale: "Les faits sont affirmés via le chat. Pas de pièce d'outil.",
    payload: {
      from: "researcher_agent",
      to: "coder_agent",
      task: "Rassembler les faits du problème",
      state: { known: { max_round_count: 10, max_stall_count: 3 }, version: "1" },
      work_done: [{ claim: "Les faits ont été collectés.", evidence_refs: ["led1"] }],
      work_remaining: ["Coder la solution"],
      evidence: [
        ev("led1", "document", "MagenticTaskLedger", T_MS, "", {
          ledger: "facts gathered in shared chat history",
        }),
      ],
    },
  },
  {
    id: "X17",
    framework: "stripe",
    title: "PaymentIntent succeeded",
    url: "https://docs.stripe.com/api/payment_intents/object",
    retrieved: RET,
    excerpt: `{
  "id": "pi_3MtwBwLkdIwHu7ix28a3tqPa",
  "object": "payment_intent",
  "amount": 2000,
  "currency": "usd",
  "status": "succeeded"
}`,
    facts: [
      "id = pi_3MtwBwLkdIwHu7ix28a3tqPa",
      "amount = 2000 usd",
      "status = succeeded",
    ],
    adapter: "status succeeded → evidence.status SUCCESS.",
    expected: "REPRENABLE",
    rationale: "Reçu Stripe identifié, statut SUCCESS, facture encore à émettre.",
    payload: {
      from: "checkout",
      to: "fulfillment",
      task: "Encaisser 20.00 USD",
      state: { known: { payment_intent: "pi_3MtwBwLkdIwHu7ix28a3tqPa" }, version: "1" },
      work_done: [{ claim: "Le paiement a été effectué.", evidence_refs: ["pi1"] }],
      work_remaining: ["Émettre la facture"],
      evidence: [
        ev("pi1", "transaction", "stripe", T_ST, "SUCCESS", {
          id: "pi_3MtwBwLkdIwHu7ix28a3tqPa",
          amount: 2000,
          currency: "usd",
          status: "succeeded",
        }),
      ],
    },
  },
  {
    id: "X18",
    framework: "stripe",
    title: "PaymentIntent canceled",
    url: "https://docs.stripe.com/api/payment_intents/object",
    retrieved: RET,
    excerpt: `{
  "id": "pi_3MtwBwLkdIwHu7ix28a3tqPa",
  "object": "payment_intent",
  "status": "canceled"
}`,
    facts: [
      "id = pi_3MtwBwLkdIwHu7ix28a3tqPa",
      "status = canceled",
    ],
    adapter: "status canceled → evidence.status CANCELLED.",
    expected: "CORROMPU",
    rationale: "L'affirmation dit effectué. Stripe dit canceled.",
    payload: {
      from: "checkout",
      to: "fulfillment",
      task: "Encaisser 20.00 USD",
      state: { known: { payment_intent: "pi_3MtwBwLkdIwHu7ix28a3tqPa" }, version: "1" },
      work_done: [{ claim: "Le paiement a été effectué.", evidence_refs: ["pi1"] }],
      work_remaining: ["Prévenir le client"],
      evidence: [
        ev("pi1", "transaction", "stripe", T_ST, "CANCELLED", {
          id: "pi_3MtwBwLkdIwHu7ix28a3tqPa",
          status: "canceled",
        }),
      ],
    },
  },
  {
    id: "X19",
    framework: "crewai",
    title: "Stagehand · chemin de capture",
    url: "https://docs.crewai.com/en/tools/web-scraping/stagehandtool",
    retrieved: RET,
    excerpt: `CrewAI's current tool loop is text-only, and its standard MCP adapter drops image blocks.
This integration saves each screenshot to a temporary file and returns the path to the agent.`,
    facts: [
      "Une capture a été écrite dans un fichier temporaire",
      "Le chemin a été renvoyé à l'agent",
      "Le bloc image n'est pas dans le message",
    ],
    adapter: "Le tool_result porte le chemin. Statut PASS car l'outil a renvoyé un path.",
    expected: "REPRENABLE",
    rationale: "La capture est sourcée par l'outil. L'inspection du fichier reste à faire.",
    payload: {
      from: "browser_agent",
      to: "analyst",
      task: "Capturer la page d'accueil",
      state: { known: { url: "https://www.example.com" }, version: "1" },
      work_done: [{ claim: "La capture a été enregistrée.", evidence_refs: ["sh1"] }],
      work_remaining: ["Ouvrir le fichier image"],
      evidence: [
        ev("sh1", "tool_result", "stagehand-mcp", T_MS, "PASS", {
          path: "/tmp/stagehand-shot.png",
        }),
      ],
    },
  },
  {
    id: "X20",
    framework: "github",
    title: "PR · politique sans journal de tests",
    url: "https://github.com/github/gh-aw/pull/37227",
    retrieved: RET,
    excerpt: `Before finishing a task and returning control to the user, the Copaldarn agent must run make agent-report-progress and verify formatting, linting, and lightweight tests all pass cleanly.`,
    facts: [
      "La politique exige make agent-report-progress avant restitution",
      "Le PR décrit la règle",
      "Aucun journal make n'est joint",
    ],
    adapter: "Le texte de politique n'est pas un résultat de make.",
    expected: "PARTIEL",
    rationale: "Les tests propres sont affirmés. Le journal make n'est pas là.",
    payload: {
      from: "copaldarn",
      to: "user",
      task: "Restituer le contrôle après validation",
      state: { known: { pr: 37227, repo: "github/gh-aw" }, version: "1" },
      work_done: [{ claim: "Les tests ont réussi.", evidence_refs: [] }],
      work_remaining: ["Restituer le contrôle"],
      evidence: [],
    },
  },
  {
    id: "X21",
    framework: "autre",
    title: "Magentic-One · tour sans reste",
    url: "https://learn.microsoft.com/en-us/training/modules/orchestrate-semantic-kernel-multi-agent-solution/8-use-magentic-orchestration",
    retrieved: RET,
    excerpt: `The standard manager coordinates agent collaboration using a chat client for planning and progress tracking. Configure parameters like maximum round count, stall count, and reset count.`,
    facts: [
      "Un tour de collaboration a eu lieu",
      "max_round_count / stall / reset sont configurés",
      "Le travail restant n'est pas listé",
    ],
    adapter: "Pas de work_remaining dans la source.",
    expected: "PARTIEL",
    rationale: "Sans reste déclaré, le suivant reconstruit le plan.",
    payload: {
      from: "manager",
      to: "researcher_agent",
      task: "Coordonner la tâche ouverte",
      state: { known: { max_round_count: 10, max_stall_count: 3 }, version: "1" },
      work_done: [{ claim: "Le plan a été produit.", evidence_refs: ["p1"] }],
      evidence: [
        ev("p1", "document", "StandardMagenticManager", T_MS, "PASS", {
          stage: "plan",
        }),
      ],
    },
  },
  {
    id: "X22",
    framework: "github",
    title: "Check run · conclusion failure",
    url: "https://docs.github.com/en/rest/checks/runs",
    retrieved: RET,
    excerpt: `{
  "status": "completed",
  "conclusion": "failure",
  "name": "build",
  "head_sha": "ce587453ced02b1526dfb4cb910479d431683101"
}`,
    facts: [
      "check name=build",
      "status=completed, conclusion=failure",
      "head_sha=ce587453ced02b1526dfb4cb910479d431683101",
    ],
    adapter: "conclusion failure → evidence.status FAIL.",
    expected: "CORROMPU",
    rationale: "L'affirmation dit compilation réussie. Le check dit failure.",
    payload: {
      from: "builder",
      to: "reviewer",
      task: "Compiler head_sha ce587453",
      state: { known: { sha: "ce587453ced02b1526dfb4cb910479d431683101" }, version: "1" },
      work_done: [{ claim: "La compilation a réussi.", evidence_refs: ["b1"] }],
      work_remaining: ["Lire le journal de build"],
      evidence: [
        ev("b1", "tool_result", "github-checks", T_GH, "FAIL", {
          name: "build",
          conclusion: "failure",
        }),
      ],
    },
  },
];

export const CORPUS_ORDER = [
  "X08",
  "X17",
  "X01",
  "X11",
  "X03",
  "X14",
  "X05",
  "X18",
  "X09",
  "X07",
  "X12",
  "X19",
  "X06",
  "X04",
  "X16",
  "X02",
  "X13",
  "X20",
  "X10",
  "X22",
  "X15",
  "X21",
] as const;

export function orderedCorpus(): CorpusCase[] {
  return CORPUS_ORDER.map((id) => CORPUS_CASES.find((c) => c.id === id)!);
}
