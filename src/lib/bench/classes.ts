export type FailureFamily = "juge" | "protocole" | "integrite" | "reset";

export interface FailureClass {
  id: string;
  family: FailureFamily;
  title: string;
  mechanism: string;
  kfp: string | null;
  emptyWhy: string | null;
}

export const FAILURE_CLASSES: FailureClass[] = [
  {
    id: "negation_sans_token_fail",
    family: "juge",
    title: "Négation sans token FAIL",
    mechanism:
      "La claim affirme un succès. L'évidence la nie par des booléens ou une structure, sans mot FAIL/error. V0 scanne des tokens, donc REPRENABLE.",
    kfp: "KFP-001",
    emptyWhy: null,
  },
  {
    id: "expected_output_non_execute",
    family: "juge",
    title: "Spécification prise pour exécution",
    mechanism:
      "expected_output, un schéma, un prompt de livrable : c'est un souhait. V0 voit un objet lié à la claim et le traite comme pièce.",
    kfp: "KFP-002",
    emptyWhy: null,
  },
  {
    id: "chemin_non_empreinte",
    family: "juge",
    title: "Chemin pris pour contenu",
    mechanism:
      "Un path, un filename, un URI. Ça nomme un endroit. Ça ne hache pas ce qui s'y trouve. V0 accepte la présence du champ.",
    kfp: "KFP-003",
    emptyWhy: null,
  },
  {
    id: "ledger_chat_non_piece_outil",
    family: "juge",
    title: "Ledger de chat pris pour outil",
    mechanism:
      "Un tour de conversation, un Magentic ledger, un résumé d'agent. C'est de la parole. Pas un tool_result adressable.",
    kfp: "KFP-004",
    emptyWhy: null,
  },
  {
    id: "lookalike_handoff",
    family: "protocole",
    title: "Handoff d'apparence",
    mechanism:
      "Middleware, currentStep, addEdge. Le graphe continue. Personne n'a déclaré un successeur. Sceller ici serait un faux destinataire.",
    kfp: null,
    emptyWhy: "Vu dans Motifs. Pas un cas du juge — le wrap se tait. Pas de KFP.",
  },
  {
    id: "preuve_impersonée",
    family: "juge",
    title: "Preuve impersonée (parent)",
    mechanism:
      "Les quatre KFP sont la même dette : quelque chose qui ressemble à une preuve pour un scanner n'en est pas une. CLAIM ≠ EVIDENCE n'est pas implémenté jusqu'au type.",
    kfp: null,
    emptyWhy: "Classe parente. Pas un cinquième cas.",
  },
  {
    id: "lie_intact",
    family: "integrite",
    title: "Mensonge intact",
    mechanism:
      "A s'engage sur une claim fausse. B reçoit les mêmes octets. SHA-256 match. Integrity ≠ Truth. Ce n'est pas une défaillance du hash.",
    kfp: null,
    emptyWhy: "Hors juge. Le sceau fait son travail.",
  },
  {
    id: "history_not_in_packet",
    family: "reset",
    title: "Histoire absente du paquet",
    mechanism:
      "B n'a que le sceau. Ce que A a vu et n'a pas hashé est irrécupérable. Mesure : ce qu'un paquet ne remplace pas.",
    kfp: null,
    emptyWhy: "Protocole gelé. Pas lancé. Pas de KFP tant que le reset n'a pas de motif.",
  },
];

export const FAMILY_LABEL: Record<FailureFamily, string> = {
  juge: "Juge V0",
  protocole: "Protocole",
  integrite: "Intégrité",
  reset: "Reset A→B",
};
