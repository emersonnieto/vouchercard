import crypto from "crypto";

export type BillingLegalAcceptanceKind = "signup" | "renewal";

export type LegalDocumentSnapshot = {
  key: "terms_of_use";
  title: string;
  version: string;
  body: string;
  hash: string;
  publicUrl: string;
  publicUrlText: string;
};

export type BillingLegalDocumentsBundle = {
  kind: BillingLegalAcceptanceKind;
  statement: string;
  statementHash: string;
  document: LegalDocumentSnapshot;
  bundleHash: string;
};

export type SubmittedBillingLegalAcceptance = {
  statement?: string;
  documentVersion?: string;
  documentHash?: string;
  bundleHash?: string;
};

const LEGAL_DOCUMENT_VERSION = "2026-04-20";
const TERMS_PUBLIC_URL = "https://termosdeuso.vouchercard.com.br/";
const TERMS_PUBLIC_URL_TEXT = "termosdeuso.vouchercard.com.br";

const TERMS_OF_USE_TITLE = "Termos de Uso e Contratacao - VoucherCard";

const SIGNUP_ACCEPTANCE_STATEMENT =
  "Li e concordo com os Termos de Uso e Contratacao do VoucherCard, incluindo as disposicoes de privacidade, o periodo de teste gratis e as regras para contratacao posterior da assinatura recorrente.";

const RENEWAL_ACCEPTANCE_STATEMENT =
  "Li e concordo com os Termos de Uso e Contratacao do VoucherCard, incluindo as disposicoes de privacidade e a autorizacao para renovacao da assinatura recorrente.";

const TERMS_OF_USE_BODY = normalizeLegalText(`
# TERMOS DE USO E CONTRATACAO DA PLATAFORMA VOUCHERCARD

Ultima atualizacao: 20 de abril de 2026

Estes Termos de Uso e Contratacao ("Termos") regulam o acesso e uso da plataforma VoucherCard, disponibilizada por ENBTECHSOLUTIONS, com operacao comercial vinculada a vouchercard.com.br, inscrita no CNPJ sob o n. 65.547.113/0001-57, com sede em Rua Jose Vicente Arantes L33, Pederneiras/SP, doravante denominada "VoucherCard" ou "CONTRATADA".

Ao marcar a opcao "Li e concordo com os Termos", concluir cadastro, iniciar contratacao, renovar assinatura, acessar o painel ou utilizar qualquer funcionalidade da plataforma, a pessoa que realiza o aceite declara que:

- leu estes Termos integralmente;
- possui poderes para agir em nome da agencia, empresa ou contratante;
- concorda com estes Termos de forma livre, informada e inequivoca;
- compromete-se a cumpri-los integralmente.

Se voce nao concordar com estes Termos, nao deve utilizar a plataforma.

## 1. Objeto

1.1. O VoucherCard e uma plataforma digital disponibilizada em modelo SaaS para uso por agencias e operacoes do setor de turismo, permitindo, entre outras funcionalidades:

- cadastro de conta e dados da agencia;
- criacao, administracao e consulta de vouchers;
- disponibilizacao de consulta publica do voucher por codigo;
- gestao da assinatura da plataforma;
- configuracao de identidade visual da agencia;
- exibicao de informacoes operacionais da viagem;
- geracao opcional de sugestoes de roteiro por inteligencia artificial, quando essa funcionalidade estiver habilitada.

1.2. Estes Termos regulam a licenca de uso temporaria, limitada, revogavel, nao exclusiva e intransferivel da plataforma, sem transferencia de propriedade intelectual.

## 2. Quem pode contratar e usar

2.1. A contratacao da plataforma deve ser realizada por pessoa capaz e com poderes para representar a agencia, empresa ou organizacao usuaria.

2.2. Ao aceitar estes Termos, o usuario declara que possui legitimidade para:

- informar os dados cadastrais da contratante;
- contratar o plano escolhido;
- autorizar cobranca recorrente;
- inserir, consultar e gerenciar dados operacionais vinculados a vouchers.

2.3. O VoucherCard podera recusar, suspender ou cancelar contas em caso de informacoes falsas, uso indevido, fraude, violacao legal ou descumprimento destes Termos.

## 3. Cadastro e conta

3.1. Para contratar ou renovar a plataforma, poderao ser solicitados dados como:

- nome da agencia;
- nome do responsavel;
- email;
- telefone;
- CPF ou CNPJ;
- endereco;
- website;
- senha;
- demais informacoes necessarias para cadastro, cobranca e validacao.

3.2. O contratante e responsavel por fornecer dados corretos, completos e atualizados.

3.3. O acesso ao painel administrativo sera feito por credenciais vinculadas a conta contratada, sendo responsabilidade do contratante:

- manter sigilo de login e senha;
- limitar o acesso a pessoas autorizadas;
- remover acessos de colaboradores ou terceiros que nao devam mais utilizar a plataforma;
- comunicar o VoucherCard em caso de suspeita de uso indevido.

## 4. Aceite eletronico e validade juridica

4.1. O aceite eletronico destes Termos, inclusive mediante checkbox, botao de confirmacao, prosseguimento no checkout, renovacao online ou uso continuado da plataforma, produz os mesmos efeitos de uma assinatura contratual.

4.2. O registro eletronico do aceite, incluindo data, hora, IP, email, identificadores da sessao ou outros elementos tecnicos razoavelmente disponiveis, podera ser utilizado como prova da contratacao e da concordancia com estes Termos.

## 5. Planos, contratacao e pagamento

5.1. O uso da plataforma depende da contratacao de um plano disponibilizado no ambiente comercial do VoucherCard.

5.2. Os valores, caracteristicas e condicoes comerciais dos planos poderao ser divulgados na pagina de contratacao, checkout, proposta comercial, painel ou outro ambiente oficial da plataforma.

5.3. Para novos cadastros, o VoucherCard podera liberar um periodo de teste gratis de 7 (sete) dias, sem cobranca inicial e sem exigencia de cartao no momento do cadastro.

5.4. O fluxo de contratacao e, na pratica, o seguinte:

1. o usuario preenche os dados da agencia e escolhe um plano;
2. a plataforma libera o acesso inicial durante o periodo de teste gratis, quando essa condicao estiver disponivel;
3. ao fim do teste gratis, o acesso podera ser bloqueado caso nao haja contratacao paga;
4. para contratar ou renovar apos o teste, a plataforma gera um checkout de pagamento recorrente;
5. o pagamento e processado pelo parceiro de cobranca;
6. confirmada a cobranca, a assinatura paga passa a vigorar e a conta permanece habilitada para uso.

5.5. O teste gratis nao gera cobranca automatica. Para continuar usando apos o periodo gratuito, o contratante devera concluir a contratacao paga no checkout disponibilizado pela plataforma.

5.6. O periodo de teste gratis pode ser oferecido apenas uma vez por agencia, email, CPF/CNPJ ou dados cadastrais equivalentes, a criterio do VoucherCard, para evitar abuso, fraude ou uso indevido.

5.7. A cobranca recorrente e atualmente estruturada por meio de parceiro de pagamento integrado a plataforma, podendo o VoucherCard alterar esse parceiro a qualquer tempo.

5.8. O contratante autoriza a realizacao da cobranca recorrente conforme o plano contratado e as regras vigentes no ato da adesao ou renovacao.

## 6. Renovacao automatica, inadimplencia e cancelamento

6.1. A assinatura funciona em regime recorrente e podera ser renovada automaticamente enquanto nao houver cancelamento.

6.2. Em caso de nao pagamento, recusa do cartao, expiracao do checkout, estorno, chargeback, cancelamento da recorrencia ou qualquer falha que impeca a confirmacao da cobranca, o VoucherCard podera:

- nao ativar a conta;
- suspender funcionalidades;
- bloquear o acesso administrativo;
- impedir consulta publica de vouchers vinculados a agencia;
- exigir nova contratacao ou renovacao.

6.3. O contratante podera solicitar o cancelamento da assinatura pelos canais ou fluxos disponibilizados na plataforma.

6.4. Quando o cancelamento for solicitado em assinatura ja ativa, a regra operacional atual da plataforma e:

- interromper a continuidade da cobranca recorrente futura;
- manter o acesso ate o fim do ciclo vigente ja confirmado ou pago;
- cancelar ou bloquear o acesso ao final desse ciclo, caso nao haja nova confirmacao de pagamento.

6.5. Em outras palavras, o cancelamento nao significa uso indefinido nem pagamento posterior. O acesso permanece apenas ate o encerramento do periodo vigente e, depois disso, a conta pode ser desativada ate que haja renovacao.

6.6. Valores ja devidos, estornos indevidos, chargebacks e prejuizos decorrentes de uso irregular poderao ser cobrados pelo VoucherCard pelos meios legais cabiveis.

## 7. Responsabilidades do contratante sobre o uso da plataforma

7.1. O contratante e integralmente responsavel pelos dados, conteudos, informacoes e instrucoes inseridos na plataforma.

7.2. Ao usar o VoucherCard, o contratante compromete-se a:

- utilizar a plataforma apenas para fins licitos;
- inserir apenas dados necessarios a finalidade operacional dos vouchers;
- nao cadastrar conteudos falsos, ofensivos, fraudulentos ou ilicitos;
- nao violar direitos de terceiros;
- nao tentar acessar areas, contas, dados ou recursos sem autorizacao;
- nao utilizar a consulta publica de voucher para exposicao indevida de informacoes.

7.3. O contratante tambem e responsavel pela forma como compartilha o codigo publico do voucher com passageiros, clientes ou terceiros autorizados.

## 8. Consulta publica de vouchers

8.1. O VoucherCard pode disponibilizar consulta publica de voucher por codigo.

8.2. O contratante reconhece que:

- o codigo deve ser tratado com cuidado;
- quem tiver acesso ao codigo podera consultar as informacoes disponibilizadas naquele voucher, conforme a estrutura da plataforma;
- cabe ao contratante compartilhar esse codigo apenas com o titular legitimo da viagem ou terceiro autorizado.

8.3. O VoucherCard podera bloquear a consulta publica de vouchers vinculados a agencias com assinatura inativa, expirada, cancelada ou inadimplente.

## 9. Inteligencia artificial e textos sugeridos

9.1. A plataforma pode oferecer, quando habilitado, recurso de geracao automatica de sugestao de roteiro com apoio de inteligencia artificial.

9.2. Esse conteudo tem natureza meramente sugestiva e informativa, nao devendo ser interpretado como confirmacao oficial de reserva, servico, horario, disponibilidade, preco ou condicao comercial.

9.3. O contratante deve revisar o texto antes de utiliza-lo comercialmente ou apresenta-lo ao cliente final, permanecendo responsavel pela comunicacao feita ao consumidor.

## 10. Servicos e integracoes de terceiros

10.1. Para operar a plataforma, o VoucherCard pode utilizar servicos de terceiros, incluindo, sem limitacao:

- parceiro de pagamento para checkout e cobranca recorrente;
- armazenamento de arquivos;
- consulta de CEP;
- servicos de inteligencia artificial;
- infraestrutura de hospedagem, banco de dados, rede, observabilidade e seguranca.

10.2. O VoucherCard podera substituir, remover ou adicionar integracoes de terceiros a qualquer tempo, desde que isso nao viole a legislacao aplicavel.

10.3. Algumas funcionalidades podem depender da disponibilidade desses terceiros, nao havendo garantia de funcionamento ininterrupto em caso de falhas externas.

## 11. Propriedade intelectual

11.1. Todos os direitos relacionados ao VoucherCard pertencem exclusivamente ao VoucherCard ou a terceiros que o tenham licenciado, incluindo:

- software;
- codigo-fonte;
- estrutura da base de dados;
- layout;
- interfaces;
- APIs;
- fluxos operacionais;
- marcas, nomes e sinais distintivos;
- textos padrao, documentacao e melhorias.

11.2. O uso da plataforma nao transfere ao contratante qualquer direito de propriedade intelectual, salvo a licenca limitada de uso durante a vigencia da assinatura.

11.3. Permanecem sob responsabilidade e titularidade do contratante os dados, marcas e conteudos que ele legitimamente inserir na plataforma.

## 12. Disponibilidade, manutencao e suporte

12.1. O VoucherCard envidara esforcos razoaveis para manter a plataforma em funcionamento, mas nao garante disponibilidade ininterrupta ou livre de falhas.

12.2. A plataforma podera ficar indisponivel, total ou parcialmente, em razao de:

- manutencao programada ou emergencial;
- atualizacoes;
- falhas tecnicas internas ou de terceiros;
- indisponibilidade do parceiro de pagamento;
- incidentes de seguranca;
- eventos de caso fortuito ou forca maior.

12.3. O suporte sera prestado pelos canais indicados pelo VoucherCard, sem SLA especifico, salvo se houver previsao expressa em proposta comercial ou contrato complementar.

## 13. Privacidade e protecao de dados pessoais

13.1. O tratamento de dados pessoais realizado no contexto da plataforma observara a Lei Geral de Protecao de Dados Pessoais - LGPD, a legislacao correlata e, quando aplicavel, orientacoes da ANPD.

13.2. Em regra:

- o contratante atua como controlador dos dados pessoais de passageiros, clientes e terceiros cujas informacoes ele decide inserir nos vouchers e na operacao comercial;
- o VoucherCard atua como operador desses dados quando os trata em nome do contratante para viabilizar hospedagem, exibicao, manutencao, organizacao, seguranca e suporte da plataforma.

13.3. O VoucherCard podera atuar como controlador independente em relacao a dados tratados para:

- cadastro e administracao da propria conta;
- autenticacao e seguranca do ambiente;
- cobranca, faturamento e registro da assinatura;
- prevencao a fraude, abuso e chargeback;
- cumprimento de obrigacoes legais, regulatorias ou defesa em processos;
- registro tecnico de eventos, logs e evidencias.

13.4. O contratante declara que possui base legal adequada para tratar e compartilhar com a plataforma os dados pessoais inseridos por ele.

13.5. O contratante e responsavel por:

- prestar informacoes de privacidade a seus clientes e passageiros quando necessario;
- coletar consentimentos quando essa for a base legal adequada;
- garantir que os dados inseridos sejam pertinentes, corretos e necessarios;
- atender, como controlador, os direitos dos titulares dos dados tratados em seu contexto comercial.

13.6. O VoucherCard adotara medidas tecnicas e administrativas razoaveis para proteger os dados pessoais tratados no ambito da plataforma, consideradas a natureza do servico e os riscos envolvidos.

13.7. O contratante nao deve utilizar a plataforma para tratamento intencional de dados pessoais sensiveis ou de dados de criancas e adolescentes sem necessidade legitima, base legal adequada e observancia integral da legislacao aplicavel.

13.8. Caso o titular de dados procure o VoucherCard para tratar de informacoes controladas pelo contratante, o VoucherCard podera encaminhar a demanda ao contratante ou orienta-lo a buscar diretamente a agencia responsavel.

## 14. Incidentes de seguranca

14.1. Em caso de incidente de seguranca que possa acarretar risco ou dano relevante aos titulares, o VoucherCard adotara as medidas cabiveis conforme a legislacao aplicavel, considerando as informacoes tecnicas disponiveis no momento.

14.2. Quando o incidente envolver dados inseridos pelo contratante em sua operacao, o VoucherCard podera comunicar o contratante para alinhamento das providencias necessarias.

## 15. Retencao e exclusao de dados

15.1. Os dados relacionados a conta, assinatura, logs, seguranca, cobranca e operacao da plataforma poderao ser mantidos pelo tempo necessario para:

- execucao destes Termos;
- cumprimento de obrigacoes legais e regulatorias;
- exercicio regular de direitos;
- auditoria, seguranca e prevencao a fraude;
- preservacao de backups e registros tecnicos.

15.2. O encerramento da assinatura nao implica exclusao imediata e automatica de todos os dados, que poderao permanecer armazenados pelos prazos tecnica e legalmente necessarios.

15.3. O VoucherCard podera eliminar, bloquear, anonimizar ou descaracterizar dados apos o encerramento da relacao, conforme sua politica interna, obrigacoes legais e viabilidade tecnica.

## 16. Suspensao e encerramento da conta

16.1. O VoucherCard podera suspender ou encerrar o acesso, com ou sem aviso previo, nos casos de:

- inadimplencia;
- fraude ou suspeita razoavel de fraude;
- chargeback;
- uso indevido da plataforma;
- violacao destes Termos;
- risco a seguranca da aplicacao ou de terceiros;
- determinacao legal, regulatoria ou judicial.

16.2. A suspensao ou encerramento da conta nao afasta obrigacoes pendentes do contratante.

## 17. Limitacao de responsabilidade

17.1. O VoucherCard nao responde:

- pelo conteudo dos vouchers cadastrados pelo contratante;
- por dados incorretos, desatualizados ou excessivos inseridos pelo contratante;
- por compartilhamento indevido de codigo publico de voucher;
- por indisponibilidades causadas por terceiros, internet, telecomunicacoes, energia, gateways, processadores de pagamento, servicos de IA ou eventos fora de seu controle razoavel;
- por decisoes comerciais, promessas ou informacoes fornecidas pelo contratante ao cliente final.

17.2. Salvo nos casos em que a legislacao vedar limitacao, a responsabilidade total do VoucherCard perante o contratante fica limitada ao valor efetivamente pago pelo contratante nos 12 (doze) meses anteriores ao fato gerador da reclamacao.

## 18. Alteracoes destes Termos

18.1. O VoucherCard podera alterar estes Termos a qualquer momento para refletir:

- evolucoes do produto;
- mudancas legais ou regulatorias;
- alteracoes operacionais, comerciais ou de seguranca.

18.2. A versao vigente sera aquela publicada nos canais oficiais da plataforma.

18.3. O uso continuado da plataforma apos a atualizacao dos Termos sera interpretado como nova concordancia com a versao entao vigente, quando permitido por lei.

## 19. Comunicacoes

19.1. O contratante concorda em receber comunicacoes relacionadas a conta, assinatura, cobranca, suporte, seguranca e atualizacoes destes Termos por meios eletronicos, inclusive email, notificacoes da plataforma, checkout ou outros canais informados no cadastro.

19.2. Para assuntos juridicos, contratuais ou de privacidade, o canal oficial do VoucherCard sera: enbtechsolutions@gmail.com, sem prejuizo da substituicao por outro canal oficial que venha a ser divulgado pela CONTRATADA.

## 20. Lei aplicavel e foro

20.1. Estes Termos sao regidos pelas leis da Republica Federativa do Brasil.

20.2. Fica eleito o foro da Comarca de Pederneiras/SP, com exclusao de qualquer outro, por mais privilegiado que seja, para resolver controversias relacionadas a estes Termos, salvo disposicao legal obrigatoria em sentido diverso.

---

# ANEXO RESUMIDO DE OPERACAO E LGPD

## A. Dados atualmente tratados no fluxo da plataforma

Dados cadastrais e de assinatura:

- nome da agencia;
- nome do responsavel;
- email;
- telefone;
- CPF ou CNPJ;
- CEP e endereco;
- senha protegida;
- identificadores de checkout, assinatura e pagamento.

Dados operacionais de voucher:

- nome do passageiro;
- codigo da reserva;
- codigo publico do voucher;
- voos;
- hotel;
- transfer;
- passeios;
- seguro;
- contatos operacionais;
- observacoes adicionais;
- sugestao de roteiro, quando habilitada.

Dados tecnicos:

- IP;
- data e hora;
- logs de autenticacao e seguranca;
- eventos de assinatura e acesso;
- registros minimos de limitacao de tentativas e protecao contra abuso.

## B. Fluxo atual de cobranca que estes Termos refletem

- novos cadastros podem receber 7 dias de teste gratis sem cartao;
- o teste gratis nao gera cobranca automatica;
- para continuar apos o teste, a contratacao ou renovacao gera um checkout recorrente;
- a assinatura paga e liberada ou renovada depois da confirmacao do pagamento;
- se a renovacao nao for confirmada ou a recorrencia for cancelada, o acesso permanece apenas ate o fim do ciclo vigente e depois pode ser bloqueado.

## C. Categorias de terceiros atualmente envolvidas

- parceiro de pagamento para cobranca recorrente;
- servico de armazenamento de logo;
- servico de consulta de CEP;
- servico de IA para geracao opcional de roteiro;
- infraestrutura de API, banco de dados, rede e hospedagem.
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

function buildDocument(body: string): LegalDocumentSnapshot {
  return {
    key: "terms_of_use",
    title: TERMS_OF_USE_TITLE,
    version: LEGAL_DOCUMENT_VERSION,
    body,
    hash: sha256Hex(body),
    publicUrl: TERMS_PUBLIC_URL,
    publicUrlText: TERMS_PUBLIC_URL_TEXT,
  };
}

function buildBundleHash(input: {
  statement: string;
  document: LegalDocumentSnapshot;
}) {
  return sha256Hex(
    [
      input.statement,
      input.document.version,
      input.document.hash,
      input.document.publicUrl,
    ].join("\n")
  );
}

const TERMS_DOCUMENT = buildDocument(TERMS_OF_USE_BODY);

export function getCurrentBillingLegalDocuments(
  kind: BillingLegalAcceptanceKind
): BillingLegalDocumentsBundle {
  const statement =
    kind === "renewal" ? RENEWAL_ACCEPTANCE_STATEMENT : SIGNUP_ACCEPTANCE_STATEMENT;

  return {
    kind,
    statement,
    statementHash: sha256Hex(statement),
    document: TERMS_DOCUMENT,
    bundleHash: buildBundleHash({
      statement,
      document: TERMS_DOCUMENT,
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
    submitted.documentVersion === current.document.version &&
    submitted.documentHash === current.document.hash &&
    submitted.bundleHash === current.bundleHash
  );
}
