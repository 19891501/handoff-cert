import { CORPUS_CASES, type CorpusCase } from "@/lib/handoff/corpus";
import { certify } from "@/lib/handoff/engine";
import type { Verdict } from "@/lib/handoff/types";

export interface AttackClass {
  id: string;
  title: string;
  versus: string;
  method: string;
}

export const ATTACKS: AttackClass[] = [
  {
    id: "trophy",
    title: "Banc trophée",
    versus: "Accuracy, classements, « 24/24 »",
    method: "On mesure l'accord avec un banc que le juge a déjà vu. Utile pour la régression. Inutile pour la croyance.",
  },
  {
    id: "leak",
    title: "Vérité scellée après",
    versus: "Ground truth dans le prompt",
    method: "Faits observables → enveloppe → juge → seulement ensuite la vérité. Un leak dans le payload invalide le cas.",
  },
  {
    id: "freeze",
    title: "Juge gelé",
    versus: "Retuner jusqu'à ce que le corpus passe",
    method: "Les faux REPRENABLE restent. On les tague. On n'écrit pas la règle manquante dans le moteur.",
  },
  {
    id: "false-r",
    title: "Faux REPRENABLE = critique",
    versus: "Accuracy globale, F1",
    method: "CORROMPU à tort → un humain vérifie. REPRENABLE à tort → une machine continue. On ne les pèse pas pareil.",
  },
  {
    id: "transfer",
    title: "Transfert de cadre",
    versus: "Un seul framework, un seul JSON",
    method: "GitHub, CrewAI, LangGraph, Microsoft, Stripe. Même règle, formes différentes. L'échec qui survit au transfert compte.",
  },
  {
    id: "reset",
    title: "Reset A→B",
    versus: "GO interne pour reconstruct",
    method: "B n'a que le paquet scellé. Pas l'historique de A. On mesure ce que le paquet ne remplace pas — y compris en négatif.",
  },
];

export interface KnownFalse {
  tag: string;
  id: string;
  classId: string;
  missingRule: string;
}

export const KNOWN_FALSE: KnownFalse[] = [
  {
    tag: "KFP-001",
    id: "X07",
    classId: "negation_sans_token_fail",
    missingRule: "Des booléens d'état qui nient la claim doivent CORROMPU, même sans token FAIL.",
  },
  {
    tag: "KFP-002",
    id: "X09",
    classId: "expected_output_non_execute",
    missingRule: "Une spécification (expected_output) n'est pas une preuve d'exécution.",
  },
  {
    tag: "KFP-003",
    id: "X10",
    classId: "chemin_non_empreinte",
    missingRule: "Un chemin de fichier n'est pas une empreinte du contenu.",
  },
  {
    tag: "KFP-004",
    id: "X16",
    classId: "ledger_chat_non_piece_outil",
    missingRule: "Un ledger de chat n'est pas une pièce d'outil.",
  },
];

export const RESET_PROTOCOL = {
  frozen: true,
  run: false,
  question: "Un agent peut-il reprendre sans l'historique, uniquement à partir du paquet scellé ?",
  steps: [
    "A produit un paquet + sceau cp.v1",
    "L'historique de A est effacé",
    "B reçoit le sceau et les hashes, pas les prompts",
    "On note reprise / échec / motif",
  ],
  threshold:
    "Négatif publiable si B échoue hors tâches triviales. Positif seulement si reprise sur une classe non triviale, reproductible.",
};

export interface FalsifyRow {
  tag: string;
  classId: string;
  caze: CorpusCase;
  actual: Verdict;
  stillFalse: boolean;
  missingRule: string;
}

export async function scanKnownFalse(): Promise<FalsifyRow[]> {
  const rows: FalsifyRow[] = [];
  for (const k of KNOWN_FALSE) {
    const caze = CORPUS_CASES.find((c) => c.id === k.id);
    if (!caze) continue;
    const cert = await certify(caze.payload);
    rows.push({
      tag: k.tag,
      classId: k.classId,
      caze,
      actual: cert.verdict,
      stillFalse: cert.verdict === "REPRENABLE" && caze.expected !== "REPRENABLE",
      missingRule: k.missingRule,
    });
  }
  return rows;
}
