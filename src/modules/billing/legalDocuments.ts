import crypto from "crypto";

export type BillingLegalAcceptanceKind = "signup" | "renewal";

export type LegalDocumentSnapshot = {
  key: "terms_of_use" | "privacy_policy";
  title: string;
  version: string;
  body: string;
  hash: string;
};

export type BillingLegalDocumentsBundle = {
  kind: BillingLegalAcceptanceKind;
  statement: string;
  statementHash: string;
  terms: LegalDocumentSnapshot;
  privacyPolicy: LegalDocumentSnapshot;
  bundleHash: string;
};

export type SubmittedBillingLegalAcceptance = {
  statement?: string;
  termsVersion?: string;
  termsHash?: string;
  privacyVersion?: string;
  privacyHash?: string;
  bundleHash?: string;
};

const LEGAL_DOCUMENT_VERSION = "2026-03-26";

const TERMS_OF_USE_TITLE = "Termos de Uso e Contratacao - VoucherCard";
const PRIVACY_POLICY_TITLE = "Politica de Privacidade - VoucherCard";

const SIGNUP_ACCEPTANCE_STATEMENT =
  "Li e concordo com os Termos de Uso e Contratacao e com a Politica de Privacidade do VoucherCard, incluindo a autorizacao para inicio da assinatura recorrente.";

const RENEWAL_ACCEPTANCE_STATEMENT =
  "Li e concordo com os Termos de Uso e Contratacao e com a Politica de Privacidade do VoucherCard, incluindo a autorizacao para renovacao da assinatura recorrente.";

const TERMS_OF_USE_BODY = normalizeLegalText(`
# Termos de Uso e Contratacao - VoucherCard

Ultima atualizacao: 26 de marco de 2026

Estes Termos de Uso e Contratacao regulam o acesso e uso da plataforma VoucherCard, disponibilizada por ENBTECHSOLUTIONS, com operacao comercial vinculada a vouchercard.com.br, inscrita no CNPJ sob o n. 65.547.113/0001-57, com sede em Rua Jose Vicente Arantes L33, Pederneiras/SP.

Ao concluir cadastro, iniciar contratacao, renovar assinatura, acessar o painel ou utilizar qualquer funcionalidade da plataforma, o usuario declara que leu integralmente estes Termos, possui poderes para agir em nome da agencia, empresa ou contratante, concorda com estes Termos e compromete-se a cumpri-los.

## 1. Objeto

O VoucherCard e uma plataforma digital disponibilizada em modelo SaaS para uso por agencias e operacoes do setor de turismo. Entre as funcionalidades disponiveis estao cadastro de conta e dados da agencia, criacao, administracao e consulta de vouchers, disponibilizacao de consulta publica por codigo, gestao da assinatura da plataforma, configuracao de identidade visual da agencia, exibicao de informacoes operacionais da viagem e geracao opcional de sugestoes de roteiro por inteligencia artificial, quando essa funcionalidade estiver habilitada.

A licenca de uso da plataforma e temporaria, limitada, revogavel, nao exclusiva e intransferivel, sem transferencia de propriedade intelectual.

## 2. Quem pode contratar e usar

A contratacao deve ser realizada por pessoa capaz e com poderes para representar a agencia, empresa ou organizacao usuaria. Ao aceitar estes Termos, o usuario declara que possui legitimidade para informar os dados cadastrais da contratante, contratar o plano escolhido, autorizar cobranca recorrente e inserir, consultar e gerenciar dados operacionais vinculados a vouchers.

O VoucherCard podera recusar, suspender ou cancelar contas em caso de informacoes falsas, uso indevido, fraude, violacao legal ou descumprimento destes Termos.

## 3. Cadastro e conta

Para contratar ou renovar a plataforma, poderao ser solicitados dados como nome da agencia, nome do responsavel, email, telefone, CPF ou CNPJ, endereco, website, senha e demais informacoes necessarias para cadastro, cobranca e validacao.

O contratante e responsavel por fornecer dados corretos, completos e atualizados, bem como manter sigilo de login e senha, limitar o acesso a pessoas autorizadas, remover acessos de terceiros que nao devam mais utilizar a plataforma e comunicar o VoucherCard em caso de suspeita de uso indevido.

## 4. Aceite eletronico e validade juridica

O aceite eletronico destes Termos, inclusive mediante checkbox, botao de confirmacao, prosseguimento no checkout, renovacao online ou uso continuado da plataforma, produz os mesmos efeitos de uma assinatura contratual.

O VoucherCard podera registrar data, hora, IP, email, identificadores tecnicos da sessao, user-agent e versao do documento aceito como elementos de prova da contratacao.

## 5. Planos, contratacao e pagamento

O uso da plataforma depende da contratacao de um plano disponibilizado no ambiente comercial do VoucherCard. Os valores, caracteristicas e condicoes comerciais dos planos poderao ser divulgados na pagina de contratacao, checkout, proposta comercial, painel ou outro ambiente oficial da plataforma.

A contratacao ocorre em ambiente online, com geracao de checkout de pagamento recorrente.

O fluxo atual de contratacao e o seguinte:

1. o usuario preenche os dados da agencia e escolhe um plano;
2. a plataforma gera um checkout de pagamento recorrente;
3. o pagamento e processado pelo parceiro de cobranca;
4. o acesso da agencia so e liberado apos a confirmacao do pagamento;
5. confirmada a cobranca, a assinatura passa a vigorar e a conta e habilitada para uso.

Nao ha, por padrao, periodo de uso gratuito com pagamento posterior. O simples cadastro, a geracao do checkout ou o preenchimento dos dados nao garantem ativacao da conta sem a efetiva confirmacao do pagamento.

A cobranca recorrente e atualmente estruturada por meio de parceiro de pagamento integrado a plataforma, podendo o VoucherCard alterar esse parceiro a qualquer tempo. O contratante autoriza a realizacao da cobranca recorrente conforme o plano contratado e as regras vigentes no ato da adesao ou renovacao.

## 6. Renovacao automatica, inadimplencia e cancelamento

A assinatura funciona em regime recorrente e podera ser renovada automaticamente enquanto nao houver cancelamento.

Em caso de nao pagamento, recusa do cartao, expiracao do checkout, estorno, chargeback, cancelamento da recorrencia ou qualquer falha que impeca a confirmacao da cobranca, o VoucherCard podera nao ativar a conta, suspender funcionalidades, bloquear o acesso administrativo, impedir consulta publica de vouchers vinculados a agencia ou exigir nova contratacao ou renovacao.

Quando o cancelamento for solicitado em assinatura ja ativa, a regra operacional atual da plataforma e interromper a continuidade da cobranca recorrente futura e manter o acesso ate o fim do ciclo vigente ja confirmado ou pago. Ao final desse ciclo, caso nao haja nova confirmacao de pagamento, a conta podera ser cancelada ou bloqueada.

## 7. Responsabilidades do contratante

O contratante e integralmente responsavel pelos dados, conteudos, informacoes e instrucoes inseridos na plataforma.

Ao usar o VoucherCard, o contratante compromete-se a utilizar a plataforma apenas para fins licitos, inserir apenas dados necessarios a finalidade operacional dos vouchers, nao cadastrar conteudos falsos, ofensivos, fraudulentos ou ilicitos, nao violar direitos de terceiros, nao tentar acessar areas, contas, dados ou recursos sem autorizacao e nao utilizar a consulta publica de voucher para exposicao indevida de informacoes.

O contratante tambem e responsavel pela forma como compartilha o codigo publico do voucher com passageiros, clientes ou terceiros autorizados.

## 8. Consulta publica de vouchers

O VoucherCard pode disponibilizar consulta publica de voucher por codigo. O contratante reconhece que o codigo deve ser tratado com cuidado e que quem tiver acesso ao codigo podera consultar as informacoes disponibilizadas naquele voucher, conforme a estrutura da plataforma. Cabe ao contratante compartilhar esse codigo apenas com o titular legitimo da viagem ou terceiro autorizado.

O VoucherCard podera bloquear a consulta publica de vouchers vinculados a agencias com assinatura inativa, expirada, cancelada ou inadimplente.

## 9. Inteligencia artificial e textos sugeridos

A plataforma pode oferecer, quando habilitado, recurso de geracao automatica de sugestao de roteiro com apoio de inteligencia artificial.

Esse conteudo tem natureza meramente sugestiva e informativa, nao devendo ser interpretado como confirmacao oficial de reserva, servico, horario, disponibilidade, preco ou condicao comercial. O contratante deve revisar o texto antes de utiliza-lo comercialmente ou apresenta-lo ao cliente final, permanecendo responsavel pela comunicacao feita ao consumidor.

## 10. Servicos e integracoes de terceiros

Para operar a plataforma, o VoucherCard pode utilizar servicos de terceiros, incluindo parceiro de pagamento para checkout e cobranca recorrente, armazenamento de arquivos, consulta de CEP, servicos de inteligencia artificial e infraestrutura de hospedagem, banco de dados, rede, observabilidade e seguranca.

Algumas funcionalidades podem depender da disponibilidade desses terceiros, nao havendo garantia de funcionamento ininterrupto em caso de falhas externas.

## 11. Propriedade intelectual

Todos os direitos relacionados ao VoucherCard pertencem exclusivamente ao VoucherCard ou a terceiros que o tenham licenciado, incluindo software, codigo-fonte, estrutura da base de dados, layout, interfaces, APIs, fluxos operacionais, marcas, nomes, sinais distintivos, textos padrao, documentacao e melhorias.

O uso da plataforma nao transfere ao contratante qualquer direito de propriedade intelectual, salvo a licenca limitada de uso durante a vigencia da assinatura.

## 12. Disponibilidade, manutencao e suporte

O VoucherCard envidara esforcos razoaveis para manter a plataforma em funcionamento, mas nao garante disponibilidade ininterrupta ou livre de falhas.

A plataforma podera ficar indisponivel, total ou parcialmente, em razao de manutencao programada ou emergencial, atualizacoes, falhas tecnicas internas ou de terceiros, indisponibilidade do parceiro de pagamento, incidentes de seguranca ou eventos de caso fortuito ou forca maior.

## 13. Privacidade e protecao de dados pessoais

O tratamento de dados pessoais realizado no contexto da plataforma observara a Lei Geral de Protecao de Dados Pessoais - LGPD, a legislacao correlata e, quando aplicavel, orientacoes da ANPD.

Em regra, o contratante atua como controlador dos dados pessoais de passageiros, clientes e terceiros cujas informacoes ele decide inserir nos vouchers e na operacao comercial, enquanto o VoucherCard atua como operador desses dados quando os trata em nome do contratante para viabilizar hospedagem, exibicao, manutencao, organizacao, seguranca e suporte da plataforma.

O VoucherCard podera atuar como controlador independente em relacao a dados tratados para cadastro e administracao da propria conta, autenticacao e seguranca do ambiente, cobranca, faturamento e registro da assinatura, prevencao a fraude, abuso e chargeback, cumprimento de obrigacoes legais, regulatorias ou defesa em processos e registro tecnico de eventos, logs e evidencias.

O contratante declara que possui base legal adequada para tratar e compartilhar com a plataforma os dados pessoais inseridos por ele e permanece responsavel por prestar informacoes de privacidade a seus clientes e passageiros, coletar consentimentos quando essa for a base legal adequada e atender, como controlador, os direitos dos titulares dos dados tratados em seu contexto comercial.

## 14. Incidentes de seguranca

Em caso de incidente de seguranca que possa acarretar risco ou dano relevante aos titulares, o VoucherCard adotara as medidas cabiveis conforme a legislacao aplicavel, considerando as informacoes tecnicas disponiveis no momento.

## 15. Retencao e exclusao de dados

Os dados relacionados a conta, assinatura, logs, seguranca, cobranca e operacao da plataforma poderao ser mantidos pelo tempo necessario para execucao destes Termos, cumprimento de obrigacoes legais e regulatorias, exercicio regular de direitos, auditoria, seguranca e prevencao a fraude, bem como preservacao de backups e registros tecnicos.

O encerramento da assinatura nao implica exclusao imediata e automatica de todos os dados.

## 16. Suspensao e encerramento da conta

O VoucherCard podera suspender ou encerrar o acesso, com ou sem aviso previo, nos casos de inadimplencia, fraude ou suspeita razoavel de fraude, chargeback, uso indevido da plataforma, violacao destes Termos, risco a seguranca da aplicacao ou de terceiros e determinacao legal, regulatoria ou judicial.

## 17. Limitacao de responsabilidade

O VoucherCard nao responde pelo conteudo dos vouchers cadastrados pelo contratante, por dados incorretos, desatualizados ou excessivos inseridos pelo contratante, por compartilhamento indevido de codigo publico de voucher, por indisponibilidades causadas por terceiros ou por decisoes comerciais, promessas ou informacoes fornecidas pelo contratante ao cliente final.

Salvo nos casos em que a legislacao vedar limitacao, a responsabilidade total do VoucherCard perante o contratante fica limitada ao valor efetivamente pago pelo contratante nos 12 meses anteriores ao fato gerador da reclamacao.

## 18. Alteracoes destes Termos

O VoucherCard podera alterar estes Termos a qualquer momento para refletir evolucoes do produto, mudancas legais ou regulatorias e alteracoes operacionais, comerciais ou de seguranca. A versao vigente sera aquela publicada nos canais oficiais da plataforma.

## 19. Comunicacoes

O contratante concorda em receber comunicacoes relacionadas a conta, assinatura, cobranca, suporte, seguranca e atualizacoes destes Termos por meios eletronicos, inclusive email, notificacoes da plataforma, checkout ou outros canais informados no cadastro.

Para assuntos juridicos, contratuais ou de privacidade, o canal oficial do VoucherCard e enbtechsolutions@gmail.com.

## 20. Lei aplicavel e foro

Estes Termos sao regidos pelas leis da Republica Federativa do Brasil.

Fica eleito o foro da Comarca de Pederneiras/SP, com exclusao de qualquer outro, por mais privilegiado que seja, para resolver controversias relacionadas a estes Termos, salvo disposicao legal obrigatoria em sentido diverso.
`);

const PRIVACY_POLICY_BODY = normalizeLegalText(`
# Politica de Privacidade - VoucherCard

Ultima atualizacao: 26 de marco de 2026

Esta Politica de Privacidade descreve, em linhas gerais, como o VoucherCard trata dados pessoais no contexto da contratacao, da operacao da plataforma, da consulta de vouchers e do suporte.

## 1. Dados que podem ser tratados

No fluxo da plataforma, podem ser tratados dados cadastrais da agencia e do responsavel, como nome, email, telefone, CPF ou CNPJ, endereco e website. Tambem podem ser tratados dados tecnicos de autenticacao, seguranca, logs, cobranca, checkout e assinatura.

No contexto operacional do voucher, podem ser tratados dados inseridos pela agencia, como nome do passageiro, codigo da reserva, codigo publico do voucher, dados de voos, hotel, transfer, passeios, seguro, contatos operacionais, observacoes adicionais e sugestoes de roteiro, quando habilitadas.

## 2. Finalidades

Os dados podem ser tratados para executar o contrato, permitir cadastro e autenticacao, viabilizar a contratacao e a cobranca recorrente, gerar e exibir vouchers, permitir consulta publica por codigo, prestar suporte, proteger a plataforma contra fraude e abuso, manter evidencias de seguranca e cumprir obrigacoes legais e regulatorias.

## 3. Bases e papeis de tratamento

Em regra, a agencia contratante atua como controladora dos dados inseridos por ela nos vouchers e na operacao comercial.

O VoucherCard atua, em regra, como operador desses dados quando os trata para hospedagem, exibicao, manutencao, organizacao, seguranca e suporte da plataforma.

O VoucherCard tambem pode atuar como controlador independente em relacao aos dados necessarios para cadastro da conta, cobranca, seguranca, logs, prevencao a fraude, defesa de direitos e cumprimento de obrigacoes legais.

## 4. Compartilhamento

O VoucherCard pode utilizar servicos de terceiros para viabilizar o funcionamento da plataforma, incluindo parceiro de pagamento para checkout e cobranca recorrente, armazenamento de arquivos, consulta de CEP, servicos de inteligencia artificial e infraestrutura de hospedagem, banco de dados, rede e seguranca.

Sempre que possivel, o compartilhamento sera limitado ao minimo necessario para a finalidade correspondente.

## 5. Seguranca

O VoucherCard adota medidas tecnicas e administrativas razoaveis para proteger os dados pessoais tratados na plataforma, observada a natureza do servico e os riscos envolvidos.

## 6. Retencao

Os dados podem ser mantidos pelo tempo necessario para execucao do servico, cumprimento de obrigacoes legais e regulatorias, exercicio regular de direitos, seguranca, auditoria, prevencao a fraude e preservacao de backups e registros tecnicos.

## 7. Direitos do titular

Quando aplicavel, os titulares podem exercer os direitos previstos na legislacao de protecao de dados, observadas as responsabilidades do controlador de cada operacao. Demandas relacionadas a dados controlados pela agencia poderao ser direcionadas a propria agencia contratante.

## 8. Contato

Para assuntos juridicos, contratuais ou de privacidade, o canal oficial do VoucherCard e enbtechsolutions@gmail.com.
`);

function normalizeLegalText(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/^\n+/, "")
    .trim();
}

function sha256Hex(value: string) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function buildDocument(
  key: LegalDocumentSnapshot["key"],
  title: string,
  body: string
): LegalDocumentSnapshot {
  return {
    key,
    title,
    version: LEGAL_DOCUMENT_VERSION,
    body,
    hash: sha256Hex(body),
  };
}

function buildBundleHash(input: {
  statement: string;
  terms: LegalDocumentSnapshot;
  privacyPolicy: LegalDocumentSnapshot;
}) {
  return sha256Hex(
    [
      input.statement,
      input.terms.version,
      input.terms.hash,
      input.privacyPolicy.version,
      input.privacyPolicy.hash,
    ].join("\n")
  );
}

const TERMS_OF_USE_DOCUMENT = buildDocument(
  "terms_of_use",
  TERMS_OF_USE_TITLE,
  TERMS_OF_USE_BODY
);

const PRIVACY_POLICY_DOCUMENT = buildDocument(
  "privacy_policy",
  PRIVACY_POLICY_TITLE,
  PRIVACY_POLICY_BODY
);

export function getCurrentBillingLegalDocuments(
  kind: BillingLegalAcceptanceKind
): BillingLegalDocumentsBundle {
  const statement =
    kind === "renewal" ? RENEWAL_ACCEPTANCE_STATEMENT : SIGNUP_ACCEPTANCE_STATEMENT;

  return {
    kind,
    statement,
    statementHash: sha256Hex(statement),
    terms: TERMS_OF_USE_DOCUMENT,
    privacyPolicy: PRIVACY_POLICY_DOCUMENT,
    bundleHash: buildBundleHash({
      statement,
      terms: TERMS_OF_USE_DOCUMENT,
      privacyPolicy: PRIVACY_POLICY_DOCUMENT,
    }),
  };
}

export function isBillingLegalAcceptanceValid(
  kind: BillingLegalAcceptanceKind,
  acceptance: SubmittedBillingLegalAcceptance | null | undefined
) {
  const submitted = acceptance ?? {};
  const current = getCurrentBillingLegalDocuments(kind);

  return (
    submitted.statement === current.statement &&
    submitted.termsVersion === current.terms.version &&
    submitted.termsHash === current.terms.hash &&
    submitted.privacyVersion === current.privacyPolicy.version &&
    submitted.privacyHash === current.privacyPolicy.hash &&
    submitted.bundleHash === current.bundleHash
  );
}
