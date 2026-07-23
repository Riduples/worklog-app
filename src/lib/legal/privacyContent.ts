import type { LegalDoc } from "@/lib/legal/types";

// Generated from the adversarially-reviewed legal-docs workflow. Wording may
// be edited here; fill company specifics (name, reg no, address, Information
// Officer, contacts) once in src/lib/legal/company.ts — every {{TOKEN}} below
// resolves from there.
export const privacyDoc: LegalDoc = {
  "documentTitle": "Worklog Privacy Policy",
  "intro": "This Privacy Policy explains how {{COMPANY_NAME}} collects, uses, shares and protects your personal information when you use Worklog. We have written it in plain language, as required by the Protection of Personal Information Act 4 of 2013 (POPIA) and the Consumer Protection Act 68 of 2008 (CPA), so that you can understand your rights and our responsibilities. Please read it together with our Terms of Service. In this policy, \"Worklog\", \"we\", \"us\" and \"our\" mean {{COMPANY_NAME}}; \"you\" and \"your\" mean the person or business that uses the Worklog service (the \"Service\"); and \"personal information\" has the meaning given to it in POPIA.",
  "effectiveDateNote": "This Privacy Policy takes effect on {{EFFECTIVE_DATE}} and replaces any earlier version. If we change it, we will update the effective date at the top and, for material changes, take reasonable steps to bring the change to your attention (see the \"Changes to this policy\" section).",
  "sections": [
    {
      "heading": "1. Who we are (the Responsible Party)",
      "blocks": [
        {
          "type": "numbered",
          "items": [
            "Worklog is operated by {{COMPANY_NAME}} (registration number {{REG_NO}}), a private company incorporated in the Republic of South Africa, with registered address {{REGISTERED_ADDRESS}}.",
            "For personal information that we process about you (our account holder), {{COMPANY_NAME}} is the Responsible Party as defined in POPIA. This means we decide why and how that information is processed, and we are accountable for it. Our role is different for the personal information you upload about your own clients, suppliers and employees, which is explained in the section 'Your own contacts and employees'.",
            "We have appointed an Information Officer who is responsible for our compliance with POPIA and for dealing with your privacy requests and questions. You can reach the Information Officer using the details below.",
            "If you have any question about this policy or about how we handle your personal information, please contact the Information Officer."
          ]
        },
        {
          "type": "bullets",
          "items": [
            "Information Officer: {{INFO_OFFICER}}",
            "Email: {{SUPPORT_EMAIL}}",
            "Registered address: {{REGISTERED_ADDRESS}}"
          ]
        }
      ]
    },
    {
      "heading": "2. Scope of this policy",
      "blocks": [
        {
          "type": "numbered",
          "items": [
            "This policy applies to personal information we process when you: (a) create and use a Worklog account; (b) use any feature of the Service, including our web app and installable Progressive Web App (PWA); (c) contact us for support; or (d) visit or interact with our website.",
            "This policy also explains how we handle personal information about your clients, suppliers and employees that you choose to upload to the Service. Our role in relation to that information is different, and is explained in the section 'Your own contacts and employees'.",
            "The Service may link to, or integrate with, third-party services (for example our payment gateway). This policy does not cover the independent privacy practices of those third parties, and we encourage you to read their own privacy notices.",
            "This policy does not form part of any contract of employment or contract for services. It may be updated from time to time in accordance with the section 'Changes to this policy'."
          ]
        }
      ]
    },
    {
      "heading": "3. The personal information we collect",
      "blocks": [
        {
          "type": "paragraph",
          "text": "3.1. We collect and process the following categories of personal information."
        },
        {
          "type": "paragraph",
          "text": "(a) Account information — your email address; and your password, which is never stored in readable form. It is stored only as a secure cryptographic hash by our authentication provider, Supabase (see the section 'Who we share your information with')."
        },
        {
          "type": "paragraph",
          "text": "(b) Business profile information — business (trading) name; VAT registration number; PAYE, SDL and other tax reference numbers; physical and postal address; and contact phone number."
        },
        {
          "type": "paragraph",
          "text": "(c) Your own contacts (third-party personal information) — the names, email addresses, phone numbers and addresses of your clients and suppliers that you upload or capture in the Service. This is personal information about other people that you provide to us. Your responsibilities for this information are set out in the section 'Your own contacts and employees'."
        },
        {
          "type": "paragraph",
          "text": "(d) Financial and transaction records — records of income and expenses; invoices, quotes and purchase orders; stock, time and mileage records; and tax estimate inputs and outputs (for example VAT201, EMP201 and provisional tax calculations)."
        },
        {
          "type": "paragraph",
          "text": "(e) Bank statement contents — the contents of bank statements that you upload, decrypt and reconcile in the Service, including transaction lines, amounts, dates and counterparties."
        },
        {
          "type": "paragraph",
          "text": "(f) Payroll information (where you use payroll) — the full names, identity (ID) numbers, tax numbers and salary details of your employees."
        },
        {
          "type": "paragraph",
          "text": "(g) Technical and usage information (collected automatically) — IP address; device and browser information; log data and usage data; and authentication and session cookie data (see the section 'Cookies')."
        },
        {
          "type": "paragraph",
          "text": "3.2. Sensitive and confidential information. Some of the information above is not 'special personal information' under section 26 of POPIA (which covers a closed list — a person's religious or philosophical beliefs, race or ethnic origin, trade union membership, political persuasion, health or sex life, biometric information, and criminal behaviour) but is nonetheless sensitive and confidential, and we treat it with heightened care as a matter of good practice. This includes: your employees' ID numbers, tax numbers and salary details (an ID number is a 'unique identifier' under POPIA), and the financial information in your transaction records and bank statements. For employee and contact information we act only as your Operator (processor) — the justification for processing that data rests with you as the Responsible Party, as explained in the section 'Your own contacts and employees'. We apply the safeguards described in the sections 'How we keep your information secure' and 'Sensitive information and children', restrict internal access, and do not use this information for any purpose other than providing the Service to you."
        },
        {
          "type": "paragraph",
          "text": "3.3. We do not knowingly collect information about children. The Service is intended only for use by businesses and adults aged 18 or older (see the section 'Sensitive information and children')."
        }
      ]
    },
    {
      "heading": "4. How we collect your information, and whether providing it is voluntary or mandatory",
      "blocks": [
        {
          "type": "numbered",
          "items": [
            "Directly from you. Most of the information we hold is provided directly by you when you register for an account, complete your business profile, capture or upload records, use payroll, upload bank statements, use our AI-assisted features, or contact us for support.",
            "Automatically. When you use the Service, we automatically collect certain technical and usage information (see 3.1(g)) through your device, our servers and essential cookies. This helps us authenticate you, keep the Service secure, and keep it working reliably.",
            "From our operators. We may receive limited information from the service providers that help us run Worklog (for example confirmation from our payment gateway that a subscription payment succeeded or failed). We do not receive or store your full card number.",
            "We do not buy personal information about you from data brokers, and we do not build advertising profiles about you."
          ]
        },
        {
          "type": "paragraph",
          "text": "4.5. Voluntary or mandatory, and the consequences of not providing information (POPIA section 18(1)(d)-(e)). Providing your account information (email and password) and core business-profile information is voluntary, but it is necessary to create and operate your account — without it we cannot provide the Service to you. Other information is required only for particular features: for example, if you do not provide payroll data we cannot run payroll or produce payslips; if you do not upload a bank statement we cannot parse or reconcile it. Some information (such as optional profile fields or any future marketing preference) is entirely optional and you may choose not to provide it. In short, the consequence of not providing required information is that we may be unable to create your account or deliver the relevant feature or the Service."
        },
        {
          "type": "paragraph",
          "text": "4.6. Laws relevant to certain collection (POPIA section 18(1)(f)). Certain information is collected or retained because South African law requires or contemplates it. In particular, tax reference numbers and your financial and transaction records are relevant to obligations under the Tax Administration Act 28 of 2011 and the Income Tax Act 58 of 1962 (including the requirement to keep business records for five years), and payroll data relates to your obligations under employment and tax legislation. We explain retention in the section 'How long we keep your information'."
        }
      ]
    },
    {
      "heading": "5. Why we process your information, and our lawful basis",
      "blocks": [
        {
          "type": "paragraph",
          "text": "5.1. POPIA requires that we process personal information lawfully and reasonably, and that each processing activity has a proper justification. Most of our processing is necessary to provide the Service you have asked for. The purposes and the lawful basis under POPIA on which we rely are set out below."
        },
        {
          "type": "bullets",
          "items": [
            "(a) Create and administer your account; authenticate you and keep your account secure — using account and technical information — necessary for the performance of our contract with you (our Terms of Service).",
            "(b) Provide the core Service (record income and expenses, manage contacts, create quotes, invoices and purchase orders, track stock, log time and mileage, and generate documents) — using business profile, your contacts and financial and transaction records — performance of our contract with you.",
            "(c) Upload, decrypt, parse and reconcile bank statements — using bank statement contents and financial records — performance of our contract with you.",
            "(d) Run basic payroll and produce payslips (PAYE / UIF / SDL) — using payroll information — performance of our contract with you and compliance with a legal obligation; and, in respect of your employees' information specifically, we act only as your Operator on your documented instruction (see the section 'Your own contacts and employees'). We do not rely on the section 27 'special personal information' employment-law exception for this data, because it is not special personal information under POPIA.",
            "(e) Produce tax estimates using SARS rates (VAT201 / EMP201 / provisional tax) for your convenience — using business profile and financial records — performance of our contract with you. These figures are estimates only and must be independently verified (see 5.4).",
            "(f) Provide AI-assisted features — 'Quick Log' natural-language capture, the help assistant, and bank-statement parsing — using the text of the transactions, queries and bank-statement content you submit to those features — performance of our contract with you (see the section 'AI-assisted features').",
            "(g) Take payment and manage your subscription, free trial, renewals, downgrades and suspension — using account and business information and payment status data — performance of our contract with you.",
            "(h) Send service and transactional communications (verification emails, receipts, security and billing notices) — using account information — performance of our contract and our legitimate interest in operating the Service.",
            "(i) Keep the Service secure, prevent and detect fraud and abuse, and diagnose and fix technical problems — using technical and usage information — our legitimate interests in protecting our Service and our users.",
            "(j) Comply with our own legal, tax and regulatory obligations, and retain records for the periods the law requires — using information relevant to the obligation — compliance with a legal obligation imposed on us.",
            "(k) Establish, exercise or defend legal claims, and enforce our Terms of Service — using information as relevant — our legitimate interests and the protection of a legitimate interest.",
            "(l) Any optional processing you specifically opt in to (for example optional marketing, if we ever offer it) — using information as relevant — your consent, which you may withdraw at any time (see the section 'Direct marketing communications')."
          ]
        },
        {
          "type": "paragraph",
          "text": "5.2. We apply POPIA's eight conditions for the lawful processing of personal information across everything we do, namely: (1) accountability; (2) processing limitation (lawfulness, minimality and consent or justification); (3) purpose specification; (4) further-processing limitation; (5) information quality; (6) openness; (7) security safeguards; and (8) data subject participation. This policy is part of how we meet the 'openness' condition."
        },
        {
          "type": "paragraph",
          "text": "5.3. Where we rely on consent, you are free to refuse or to withdraw it at any time, without affecting the lawfulness of processing before withdrawal. Where we rely on legitimate interests, we have weighed those interests against your rights and freedoms."
        },
        {
          "type": "paragraph",
          "text": "5.4. Estimates and generated documents are not professional advice. Worklog is a software record-keeping tool. It is not a registered accountant, auditor, tax practitioner, or financial or legal adviser, and it provides no professional advice. All tax figures, SARS rates, calculations and generated documents (including invoices, quotes and payslips) are provided for convenience and estimation only. They may be incomplete, incorrect or out of date, and you must independently verify them. You remain solely responsible for your own SARS, CIPC and other statutory compliance and for every decision you make using the Service. AI-assisted features can produce errors and must be checked by you."
        }
      ]
    },
    {
      "heading": "6. Your own contacts and employees (you are the Responsible Party)",
      "blocks": [
        {
          "type": "numbered",
          "items": [
            "When you upload or capture personal information about other people — your clients, your suppliers and your employees — you are the Responsible Party for that information, and Worklog acts as your Operator (processor). We process it only on your documented instruction and to provide the Service to you. We do not use your contacts' or employees' personal information for our own purposes, and we do not carry our own separate lawful-processing justification for it — that justification rests with you.",
            "By uploading or capturing that information, you warrant that: (a) you have a lawful basis under POPIA (for example consent, contractual necessity, or a legal obligation) to collect it and to give it to us to process on your behalf; (b) where required, you have given the necessary notices to, and obtained any necessary consents from, those individuals; (c) you have a lawful basis to process your employees' information (including ID numbers, tax numbers and salaries) for payroll purposes; (d) you have a lawful basis under section 72 of POPIA to permit that information to be transferred to and processed by our operators outside South Africa (see the section 'Cross-border transfers of information'); and (e) your instructions to us will not cause us or you to breach POPIA or any other law.",
            "As your Operator, we will: process this information only for the purposes of providing the Service and on your instruction; apply appropriate security safeguards; treat it as confidential; and notify you without undue delay if we have a reasonable belief that it has been accessed or acquired by an unauthorised person, so that you can meet your own obligations.",
            "You are responsible for responding to any request or complaint that your own clients, suppliers or employees make to you about their personal information (for example a request to access, correct or delete it). We will give you reasonable assistance to do so, and you can also correct or delete this information yourself using the Service."
          ]
        }
      ]
    },
    {
      "heading": "7. Who we share your information with (our Operators)",
      "blocks": [
        {
          "type": "numbered",
          "items": [
            "We do not sell your personal information, and we do not share it for third-party advertising.",
            "We share personal information with a small number of trusted service providers ('Operators' under POPIA) who process it on our behalf, under written contracts that require them to keep it confidential and secure and to process it only on our instructions. Each is listed below with its purpose and the country in which it processes the data."
          ]
        },
        {
          "type": "bullets",
          "items": [
            "Supabase — database, authentication and file storage (this is where your records and files are stored, and where your password is held as a secure hash). Hosted in the European Union, on Amazon Web Services in eu-west-1, Ireland.",
            "Vercel Inc. — application hosting and content delivery. Primary application and data processing occurs in the United States; delivery of the app's static assets (its content-delivery-network function) may occur from edge locations closer to you, but your personal records are processed in the United States.",
            "Anthropic PBC — provides the Claude AI that powers our AI-assisted features. It receives the text of the transactions, queries and bank-statement content you submit to those features. United States. See the section 'AI-assisted features' for the limits on how Anthropic may use this content.",
            "Payfast (Pty) Ltd — payment gateway that processes your subscription payments. Your card details are handled by Payfast; Worklog does not store your full card number. South Africa.",
            "Resend — delivery of transactional emails (for example verification and billing emails). United States, on Amazon Web Services."
          ]
        },
        {
          "type": "paragraph",
          "text": "7.3. Sub-operators. Our Operators may engage their own sub-operators (sub-processors) to help deliver their services — for example, underlying cloud infrastructure such as Amazon Web Services. We require each Operator to bind any sub-operator to written terms providing a level of protection consistent with this policy and POPIA, and each Operator remains responsible to us for its sub-operators."
        },
        {
          "type": "paragraph",
          "text": "7.4. Other disclosures. We may also disclose personal information: (a) where required by law, court order, or a valid request from a competent authority; (b) to establish, exercise or defend legal claims; (c) to protect the rights, safety or property of Worklog, our users or the public; or (d) in connection with a merger, acquisition or sale of all or part of our business, in which case we will require the recipient to protect your information in a manner consistent with this policy."
        }
      ]
    },
    {
      "heading": "8. AI-assisted features and how your content is used",
      "blocks": [
        {
          "type": "numbered",
          "items": [
            "Worklog's AI-assisted features — 'Quick Log' natural-language capture, the help assistant, and bank-statement parsing — are powered by Claude, provided by Anthropic PBC in the United States. To provide these features, the text you submit to them (which can include transaction details, your questions, full bank-statement contents, and any contact or employee information captured through Quick Log) is sent to Anthropic to generate the requested output.",
            "Anthropic acts as our Operator for this content. Under our agreement with Anthropic, this content is processed only to return the output you requested; it is not used to train or improve Anthropic's general AI models; and it is retained only transiently, or for a limited period, before deletion, in accordance with Anthropic's commercial data-processing terms. If this position ever changes, we will update this policy and tell you before the change takes effect.",
            "Because some of this content is financial and sensitive, and may include third-party personal information, you should submit only what is necessary and should not include information you are not permitted to share. The cross-border safeguards for this transfer are described in the section 'Cross-border transfers of information'.",
            "AI outputs are suggestions and estimates. Everything the AI produces — Quick Log entries, parsed statements, categorisations and tax estimates — is a draft that you review, edit and confirm. It may contain errors and must be checked by you (see 5.4). You can choose not to use the AI-assisted features and still use the rest of the Service; if you would prefer not to use them, contact us at {{SUPPORT_EMAIL}}."
          ]
        }
      ]
    },
    {
      "heading": "9. Cross-border transfers of information",
      "blocks": [
        {
          "type": "numbered",
          "items": [
            "Because some of our Operators are located outside South Africa, personal information processed through the Service — including your own information and, where you upload it, information about your clients, suppliers and employees — is processed in the European Union (Supabase, in Ireland) and in the United States (Vercel, Anthropic and Resend). This is a cross-border transfer of personal information under section 72 of POPIA.",
            "Primary basis for all transfers — contractual protection (section 72(1)(b)). The primary safeguard we rely on for every category of personal information and every Operator (including information about your contacts and employees) is that each Operator is bound by a written agreement — including data-processing terms and, where relevant, standard contractual clauses — that requires it to provide an adequate level of protection substantially similar to POPIA's conditions and to process the information only for the agreed purposes.",
            "Additional bases for your own information. For your own personal information as the account holder, we also rely, where applicable, on: (a) the transfer being necessary for the performance of our contract with you, or for pre-contractual steps taken at your request (section 72(1)(c)); and/or (b) your consent (section 72(1)(d)).",
            "Where Worklog processes personal information about your clients, suppliers and employees, it does so as your Operator, and the cross-border transfer of that information relies on the contractual-protection safeguard in section 72(1)(b) above. As the Responsible Party for that information (see the section 'Your own contacts and employees'), you remain responsible for having a lawful basis under section 72 to permit the transfer of your data subjects' information abroad; our operator agreements provide the contractual safeguard that enables it.",
            "We take reasonable steps to satisfy ourselves that our Operators protect your information to a standard that meets POPIA's requirements."
          ]
        }
      ]
    },
    {
      "heading": "10. Automated decision-making",
      "blocks": [
        {
          "type": "paragraph",
          "text": "10.1. We do not make decisions about you based solely on automated processing (including profiling) that have legal or similarly significant effects on you, as contemplated by section 71 of POPIA."
        },
        {
          "type": "paragraph",
          "text": "10.2. The Service's automated features — AI-generated tax estimates, bank-statement parsing and categorisation, and 'Quick Log' auto-capture — produce suggestions and estimates that you review, edit and control. You remain the decision-maker: there is always a 'human in the loop' (you), and no output is treated as a final decision until you confirm it. Your related right is described in the section 'Your rights under POPIA'."
        }
      ]
    },
    {
      "heading": "11. Sensitive information and children",
      "blocks": [
        {
          "type": "paragraph",
          "text": "11.1. Sensitive and confidential information. As noted in 3.2, the payroll data you enter about your employees (ID numbers, tax numbers and salaries) and the financial information in your records and bank statements are sensitive and confidential, even though they are not 'special personal information' under section 26 of POPIA. We process this information only to provide the Service, and for employee data only as your Operator on your instruction. We apply the security measures in the section 'How we keep your information secure', restrict internal access, and do not use it for any purpose other than providing the Service to you."
        },
        {
          "type": "paragraph",
          "text": "11.2. Children. The Service is intended for use by businesses and by adults aged 18 or older. We do not knowingly collect personal information about children (persons under 18) as our own account holders, and the Service is not directed at children. If you use payroll to process information about an employee who is a minor, you are responsible for ensuring that you have the competent person's consent and any other authorisation the law requires. If we learn that we have inadvertently collected personal information from a child as an account holder without proper authorisation, we will take reasonable steps to delete it."
        }
      ]
    },
    {
      "heading": "12. How we keep your information secure",
      "blocks": [
        {
          "type": "paragraph",
          "text": "12.1. We take the security of your information seriously and maintain appropriate, reasonable technical and organisational measures to protect it against loss, damage, unauthorised access and unauthorised processing, as required by POPIA. These measures include:"
        },
        {
          "type": "bullets",
          "items": [
            "Encryption in transit — information exchanged between your device and the Service is encrypted using industry-standard transport encryption (TLS/HTTPS).",
            "Access controls and row-level security — our database (Supabase) enforces row-level security so that you can access only your own data, and internal access by our personnel is limited to those who need it to operate and support the Service.",
            "Password protection — passwords are stored only as secure hashes by our authentication provider, Supabase, never in readable form.",
            "Reputable hosted infrastructure — we host with established providers (see the section 'Who we share your information with') who maintain their own strong physical and network security.",
            "Ongoing measures — we monitor for vulnerabilities and apply updates and other safeguards as appropriate."
          ]
        },
        {
          "type": "paragraph",
          "text": "12.2. No system is perfectly secure. While we work hard to protect your information, we cannot guarantee absolute security. You also play an important part: keep your password confidential, use a strong and unique password, and notify us promptly if you suspect any unauthorised use of your account."
        },
        {
          "type": "paragraph",
          "text": "12.3. Security compromises (POPIA section 22). If there are reasonable grounds to believe that your personal information has been accessed or acquired by an unauthorised person, we will notify the Information Regulator and you as soon as reasonably possible after becoming aware of the compromise. Our notification to you will be in writing and communicated in one of the ways permitted by section 22(4), and will provide sufficient information to allow you to take protective measures, including, if known: (a) a description of the possible consequences of the compromise; (b) the measures we intend to take or have taken to address it; (c) a recommendation on the steps you should take to reduce any potential harm; and (d) the identity of the unauthorised person, if known. Where we act as your Operator for your contacts' or employees' data (see the section 'Your own contacts and employees'), we will notify you so that you can meet your own notification obligations."
        }
      ]
    },
    {
      "heading": "13. How long we keep your information (retention)",
      "blocks": [
        {
          "type": "numbered",
          "items": [
            "We keep your personal information for as long as your account is active and you are using the Service.",
            "After your account is closed, we may retain your business and transaction records for the period required by South African law. In particular, South African tax legislation (including the Tax Administration Act 28 of 2011) generally requires business records to be kept for five (5) years. We will therefore retain data for the legally required period after account closure so that you (and we) can meet those obligations.",
            "Once the applicable retention period has passed, and where we are not otherwise required or permitted by law to keep the information, we will delete or de-identify it so that it can no longer be linked to you.",
            "We may keep aggregated or de-identified information (which does not identify you) for longer, to understand and improve the Service."
          ]
        }
      ]
    },
    {
      "heading": "14. Closing your account, deletion and data export",
      "blocks": [
        {
          "type": "numbered",
          "items": [
            "You may close your account at any time. To do so, use the account-closure option in the Service where available, or email our Information Officer at {{SUPPORT_EMAIL}}. You may also cancel your subscription separately in line with our Terms of Service.",
            "Before you close your account, you can export your data from the Service. If you need help obtaining an export, contact us at {{SUPPORT_EMAIL}} and we will assist you.",
            "When your account is closed, your access to the Service ends and we begin the retention-and-deletion process described in the section 'How long we keep your information'. Some information will be retained for the legally required period before it is deleted or de-identified.",
            "You can also ask us to delete personal information we are no longer authorised to keep, as described in the section 'Your rights under POPIA'."
          ]
        }
      ]
    },
    {
      "heading": "15. Your rights under POPIA",
      "blocks": [
        {
          "type": "paragraph",
          "text": "15.1. POPIA gives you important rights over your personal information. Subject to the conditions and exceptions in the Act, you have the right to:"
        },
        {
          "type": "bullets",
          "items": [
            "(a) be told what personal information we hold about you, to request access to it, and to be told the identity of (or the categories of) all third parties who have, or have had, access to it (section 23);",
            "(b) request correction of personal information that is inaccurate, irrelevant, excessive, out of date, incomplete, misleading or unlawfully obtained;",
            "(c) request deletion or destruction of personal information we are no longer authorised to keep;",
            "(d) object, on reasonable grounds, to the processing of your personal information;",
            "(e) withdraw your consent where we rely on consent, at any time (this will not affect processing that already took place, and may affect our ability to provide certain features);",
            "(f) not be subject to a decision based solely on automated processing that has legal or similarly significant effects on you, other than as permitted by POPIA (see the section 'Automated decision-making'); and",
            "(g) complain to the Information Regulator (see the section 'Complaining to the Information Regulator')."
          ]
        },
        {
          "type": "paragraph",
          "text": "15.2. How to exercise your rights. You can update much of your information yourself inside the Service. For anything else, contact our Information Officer at {{SUPPORT_EMAIL}}. To protect your information, we may need to verify your identity before acting on a request."
        },
        {
          "type": "paragraph",
          "text": "15.3. Prescribed forms. POPIA ties two rights to prescribed forms, and we will supply them proactively. To object to the processing of your information (POPIA Form 1) or to request correction or deletion of your information (POPIA Form 2), email {{SUPPORT_EMAIL}} and we will send you the correct form, or you can download it from the Information Regulator's website at https://inforegulator.org.za. You may also make the request in a plain email and we will help you complete any required form. Formal requests for access to records are made under the Promotion of Access to Information Act 2 of 2000 (PAIA) using the prescribed PAIA request form (Form 2) and our PAIA manual (see the section 'PAIA manual')."
        },
        {
          "type": "paragraph",
          "text": "15.4. Timeframes and fees. We will acknowledge your request promptly and respond within a reasonable time, and in any event within the periods required by POPIA and PAIA — for access requests, generally 30 days, extendable where the law allows, in which case we will tell you why. A request for access may, where the law allows, be subject to a prescribed fee, which we will tell you about in advance."
        }
      ]
    },
    {
      "heading": "16. Direct marketing communications",
      "blocks": [
        {
          "type": "numbered",
          "items": [
            "Service and transactional messages. We send you service and transactional communications (for example verification emails, receipts, and security and billing notices) as a necessary part of providing the Service. These are not marketing and continue for as long as you have an account.",
            "Marketing messages. We do not currently send marketing, but if we ever do, any electronic direct marketing will comply with section 69 of POPIA and section 45 of the Electronic Communications and Transactions Act 25 of 2002 (ECTA). We will send electronic marketing only where you have given your prior opt-in consent (for people who are not existing customers, consent will be requested only once, in the manner prescribed by POPIA), or where you are an existing customer and the marketing relates to our own similar products or services and you were given a clear opportunity to opt out when we collected your details.",
            "Unsubscribe. Every marketing message will identify us and include a free and easy way to opt out. You can also unsubscribe at any time by emailing {{SUPPORT_EMAIL}}. Opting out of marketing will not stop the service and transactional messages described above."
          ]
        }
      ]
    },
    {
      "heading": "17. Complaining to the Information Regulator",
      "blocks": [
        {
          "type": "paragraph",
          "text": "17.1. If you are not satisfied with how we have handled your personal information or your privacy request, you have the right to lodge a complaint with the Information Regulator (South Africa). We would appreciate the chance to address your concern first, but you may approach the Regulator at any time. Its details are:"
        },
        {
          "type": "bullets",
          "items": [
            "Physical address: JD House, 27 Stiemens Street, Braamfontein, Johannesburg, 2001",
            "Postal address: P.O. Box 31533, Braamfontein, Johannesburg, 2017",
            "Complaints email: complaints.IR@justice.gov.za",
            "General enquiries email: enquiries.IR@justice.gov.za",
            "Website: https://inforegulator.org.za"
          ]
        }
      ]
    },
    {
      "heading": "18. PAIA manual (access to information)",
      "blocks": [
        {
          "type": "paragraph",
          "text": "18.1. As a private body and Responsible Party, {{COMPANY_NAME}} maintains a manual under section 51 of the Promotion of Access to Information Act 2 of 2000 (PAIA). The PAIA manual explains the records we hold and how to request access to them."
        },
        {
          "type": "paragraph",
          "text": "18.2. You can obtain a copy of our PAIA manual, free of charge, on request from our Information Officer at {{SUPPORT_EMAIL}}, or where we make it available, from our website. Formal access requests should follow the procedure set out in the PAIA manual."
        }
      ]
    },
    {
      "heading": "19. Cookies",
      "blocks": [
        {
          "type": "numbered",
          "items": [
            "Worklog uses only essential authentication and session cookies. These are necessary to sign you in, keep you signed in, keep your session secure, and make the Service work. Without them, the Service cannot function properly.",
            "We do not use third-party advertising cookies, and we do not track you across other websites for advertising purposes.",
            "Because these cookies are strictly necessary to provide a service you have requested, they do not require separate consent. You can block or delete cookies in your browser settings, but if you do, parts of the Service may stop working (for example, you may not be able to stay signed in)."
          ]
        }
      ]
    },
    {
      "heading": "20. Changes to this policy",
      "blocks": [
        {
          "type": "numbered",
          "items": [
            "We may update this policy from time to time — for example if we add features, change our Operators, or if the law changes.",
            "When we make changes, we will update the effective date at the top of this policy and publish the updated version in the Service. If the changes are material, we will take reasonable steps to bring them to your attention, for example by email or by an in-app notice.",
            "Your continued use of the Service after an updated policy takes effect means that you have read and understood the changes. If you do not agree with a change, you may stop using the Service and close your account."
          ]
        }
      ]
    },
    {
      "heading": "21. Contact us",
      "blocks": [
        {
          "type": "paragraph",
          "text": "21.1. If you have any questions, requests or concerns about this policy or about how we handle your personal information, please contact our Information Officer:"
        },
        {
          "type": "bullets",
          "items": [
            "{{COMPANY_NAME}} (registration number {{REG_NO}})",
            "Information Officer: {{INFO_OFFICER}}",
            "Email: {{SUPPORT_EMAIL}}",
            "Registered address: {{REGISTERED_ADDRESS}}"
          ]
        },
        {
          "type": "paragraph",
          "text": "21.2. This Privacy Policy is governed by the laws of the Republic of South Africa and should be read together with our Terms of Service. Any dispute relating to it is subject to the jurisdiction of the courts of {{GOVERNING_PROVINCE}}."
        }
      ]
    }
  ],
  "placeholdersUsed": [
    "{{COMPANY_NAME}}",
    "{{REG_NO}}",
    "{{REGISTERED_ADDRESS}}",
    "{{INFO_OFFICER}}",
    "{{SUPPORT_EMAIL}}",
    "{{EFFECTIVE_DATE}}",
    "{{GOVERNING_PROVINCE}}"
  ]
};
