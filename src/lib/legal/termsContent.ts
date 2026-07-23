import type { LegalDoc } from "@/lib/legal/types";

// Generated from the adversarially-reviewed legal-docs workflow. Wording may
// be edited here; fill company specifics (name, reg no, address, Information
// Officer, contacts) once in src/lib/legal/company.ts — every {{TOKEN}} below
// resolves from there.
export const termsDoc: LegalDoc = {
  "documentTitle": "Worklog — Terms of Service",
  "effectiveDateNote": "These Terms take effect on {{EFFECTIVE_DATE}} and apply to your use of Worklog from that date. We may update them from time to time as described in the \"Changes to these Terms\" section; the version in force is always the one published in the Service bearing the current effective date.",
  "intro": "Please read these Terms of Service (\"Terms\") carefully. They form a legally binding agreement between you and {{COMPANY_NAME}} (Registration No. {{REG_NO}}), the provider of the Worklog service. They set out the rules for using Worklog, what you can expect from us, and what we expect from you. Important — before you go further: Worklog is a software tool for keeping business records. It is not an accountant, auditor, tax practitioner, or financial or legal adviser, and it does not give professional advice. Any tax figures, SARS rates, calculations and documents it produces are estimates provided for your convenience only; they may be incomplete, incorrect or out of date, must be checked by you, and you remain responsible for your own compliance and decisions. Section 13 (No accounting, tax or financial advice), Section 14 (AI-assisted features) and Section 17 (Limitation of liability) are especially important, and by using Worklog you agree to them. Nothing in these Terms takes away any right you have under South African law that cannot lawfully be excluded, including under the Consumer Protection Act 68 of 2008 (CPA), the Electronic Communications and Transactions Act 25 of 2002 (ECTA) and the Protection of Personal Information Act 4 of 2013 (POPIA).",
  "placeholdersUsed": [
    "{{COMPANY_NAME}}",
    "{{REG_NO}}",
    "{{REGISTERED_ADDRESS}}",
    "{{INFO_OFFICER}}",
    "{{SUPPORT_EMAIL}}",
    "{{SUPPORT_PHONE}}",
    "{{WEBSITE_URL}}",
    "{{EFFECTIVE_DATE}}",
    "{{GOVERNING_PROVINCE}}"
  ],
  "sections": [
    {
      "heading": "1. Definitions",
      "blocks": [
        {
          "type": "paragraph",
          "text": "1.1 In these Terms, unless the context requires otherwise:"
        },
        {
          "type": "bullets",
          "items": [
            "1.1.1 \"Account\" means the user account you register in order to access and use the Service.",
            "1.1.2 \"AI Features\" means the artificial-intelligence-assisted functions of the Service, including the \"Quick Log\" natural-language capture tool, the in-app help assistant, and the bank-statement parsing tool, which are powered by a third-party AI provider as described in Section 14.",
            "1.1.3 \"Authorised User\" means a natural person whom you permit to access and use the Service under your Account, as described in clause 5.6.",
            "1.1.4 \"CPA\" means the Consumer Protection Act 68 of 2008.",
            "1.1.5 \"ECTA\" means the Electronic Communications and Transactions Act 25 of 2002.",
            "1.1.6 \"Intellectual Property\" means all intellectual property rights of any kind, including copyright, trade marks, trade names, logos, patents, design rights, database rights, know-how, and rights in software and source code, whether registered or not.",
            "1.1.7 \"Operator\" has the meaning given to it in POPIA, and includes the third-party service providers listed in Section 15 and in the Privacy Policy that process personal information to help provide the Service.",
            "1.1.8 \"Payfast\" means Payfast (Pty) Ltd, the third-party payment gateway through which subscription fees are collected.",
            "1.1.9 \"POPIA\" means the Protection of Personal Information Act 4 of 2013.",
            "1.1.10 \"Privacy Policy\" means our Privacy Policy, which forms part of these Terms and describes how we process personal information, available within the Service and at {{WEBSITE_URL}}.",
            "1.1.11 \"Service\" means the Worklog application (a progressive web application / installable web app), including its website at {{WEBSITE_URL}}, software, features, functionality, and any documents it generates, as made available by us from time to time.",
            "1.1.12 \"Subscription\" means a paid, tiered, monthly subscription to the Service.",
            "1.1.13 \"Us\", \"we\", \"our\" and \"Worklog\" mean {{COMPANY_NAME}} (Registration No. {{REG_NO}}), the provider of the Service.",
            "1.1.14 \"User Content\" means all data, records, documents, text, files, contact details and other information that you upload to, enter into, or generate using the Service, including financial records, bank-statement contents, and the personal information of third parties.",
            "1.1.15 \"You\" and \"your\" mean the person who accepts these Terms and uses the Service, and, where that person acts for a business, the business on whose behalf they act."
          ]
        },
        {
          "type": "paragraph",
          "text": "1.2 Headings are for convenience only and do not affect interpretation. Words importing the singular include the plural and vice versa. A reference to a statute is a reference to that statute as amended or replaced from time to time. A reference to a \"Section\" is to a numbered section of these Terms, and to a \"clause\" is to a numbered provision within a Section."
        }
      ]
    },
    {
      "heading": "2. Acceptance and eligibility",
      "blocks": [
        {
          "type": "paragraph",
          "text": "2.1 By creating an Account, clicking or tapping to accept these Terms, or using the Service, you agree to be bound by these Terms and by the Privacy Policy. If you do not agree, you must not use the Service."
        },
        {
          "type": "paragraph",
          "text": "2.2 You may only use the Service if you:"
        },
        {
          "type": "bullets",
          "items": [
            "2.2.1 are at least 18 years of age;",
            "2.2.2 have the legal capacity to enter into a binding contract; and",
            "2.2.3 are using the Service for business, trade, professional or other commercial purposes. The Service is designed and intended for business record-keeping and is not intended for personal, household or domestic use."
          ]
        },
        {
          "type": "paragraph",
          "text": "2.3 The business-use requirement in clause 2.2.3 describes what the Service is for. It does not, and is not intended to, take away any protection the law gives you. We acknowledge that many of our users are natural persons or smaller juristic persons who are \"consumers\" under the CPA and/or the ECTA, and these Terms must be read so as to preserve every right such a user has that cannot lawfully be excluded (see clauses 6.6 and 17.6)."
        },
        {
          "type": "paragraph",
          "text": "2.4 If you accept these Terms or use the Service on behalf of a business, company, close corporation, partnership, trust or other entity, you warrant that you are duly authorised to bind that entity, and \"you\" in these Terms refers to both you personally and that entity, who are bound jointly."
        },
        {
          "type": "paragraph",
          "text": "2.5 You are responsible for ensuring that your use of the Service complies with all laws that apply to you."
        }
      ]
    },
    {
      "heading": "3. Electronic transactions and communications (ECTA)",
      "blocks": [
        {
          "type": "paragraph",
          "text": "3.1 You agree to transact and communicate with us electronically. You consent to entering into these Terms, and any changes to them, by electronic means, and you agree that your clicking, tapping or ticking to accept, and other electronic records of your acceptance, are a valid and binding form of agreement."
        },
        {
          "type": "paragraph",
          "text": "3.2 You consent to receiving all agreements, notices, disclosures, statements, tax invoices, receipts and other communications from us in electronic form, whether by email to the address linked to your Account or by notice within the Service. You may withdraw this consent for future communications by contacting us at {{SUPPORT_EMAIL}}, but if you do we may be unable to continue providing the Service to you."
        },
        {
          "type": "paragraph",
          "text": "3.3 You agree that, to the fullest extent permitted by the ECTA, electronic records, data messages and click, tap or tick acceptance satisfy any requirement in law that information be \"in writing\", be signed, or be presented or retained in a particular form. This clause supports the acceptance mechanism in Section 2 and the notice regime in Section 22."
        }
      ]
    },
    {
      "heading": "4. Description of the Service",
      "blocks": [
        {
          "type": "paragraph",
          "text": "4.1 Worklog is a mobile-first, cloud-based software tool that helps small and informal businesses keep records. Depending on your Subscription tier, the Service allows you to, among other things:"
        },
        {
          "type": "bullets",
          "items": [
            "4.1.1 record income and expenses;",
            "4.1.2 manage client and supplier contacts;",
            "4.1.3 create quotes, invoices and purchase orders;",
            "4.1.4 track stock;",
            "4.1.5 log time and mileage;",
            "4.1.6 upload, decrypt, parse, categorise and reconcile bank statements;",
            "4.1.7 run convenience payroll calculations (including PAYE, UIF and SDL), which we do not warrant are accurate, complete or current;",
            "4.1.8 view tax estimates (such as VAT201, EMP201 and provisional tax) generated using SARS rates as published from time to time, which we do not warrant are complete, current or correctly applied; and",
            "4.1.9 generate documents such as invoices, quotes and payslips."
          ]
        },
        {
          "type": "paragraph",
          "text": "4.2 The functions described in clauses 4.1.6 to 4.1.9 are convenience tools only. The outputs they produce are not verified by us and must be checked by you before you rely on them. Section 13 must be read together with this Section, and qualifies every statement of functionality in it."
        },
        {
          "type": "paragraph",
          "text": "4.3 The Service is a software tool only. It is a self-service record-keeping and calculation utility. It is not a registered accountant, auditor, tax practitioner, bookkeeper, payroll bureau, or financial or legal adviser, and no person at Worklog is rendering any professional service to you through the Service. The Service does not review your records, does not exercise professional judgement, and does not submit anything to SARS, the CIPC or any other authority on your behalf. Section 13 must be read together with this clause."
        },
        {
          "type": "paragraph",
          "text": "4.4 We may add, change, suspend or remove features of the Service from time to time. We will try to give reasonable notice of material changes that reduce core functionality, but we are not obliged to maintain any particular feature."
        }
      ]
    },
    {
      "heading": "5. Accounts, security and authorised users",
      "blocks": [
        {
          "type": "paragraph",
          "text": "5.1 To use the Service you must register an Account and provide accurate, current and complete information, and keep it up to date."
        },
        {
          "type": "paragraph",
          "text": "5.2 You are responsible for keeping your Account credentials (including your password) confidential. You must not share your credentials, except with your Authorised Users under clause 5.6, or let anyone else use your Account without authorisation."
        },
        {
          "type": "paragraph",
          "text": "5.3 You are responsible for all activity that occurs under your Account and by your Authorised Users, whether or not you authorised it, except to the extent the activity results from our own breach of these Terms or our failure to meet a legal duty we owe you."
        },
        {
          "type": "paragraph",
          "text": "5.4 You must notify us as soon as reasonably possible at {{SUPPORT_EMAIL}} or {{SUPPORT_PHONE}} if you become aware of, or suspect, any unauthorised access to or use of your Account, any loss or theft of your credentials, or any other security breach affecting the Service."
        },
        {
          "type": "paragraph",
          "text": "5.5 We may suspend or restrict access to your Account where we reasonably believe this is necessary to protect the security or integrity of the Service or of other users, and will let you know where it is lawful and practical to do so."
        },
        {
          "type": "paragraph",
          "text": "5.6 Authorised Users. You may permit your own staff, bookkeeper, accountant or other representatives to access and use the Service under your Account as Authorised Users, where the Service provides for this. Permitting your own Authorised Users to use your Account in this way is not a prohibited grant to a third party under clause 8.1.7. You are responsible for your Authorised Users' use of the Service and for their compliance with these Terms, and you must ensure that each Authorised User is authorised by you and keeps their access credentials confidential."
        }
      ]
    },
    {
      "heading": "6. Subscriptions, free trial, billing and cancellation",
      "blocks": [
        {
          "type": "paragraph",
          "text": "6.1 Tiers and fees. The Service is offered on tiered monthly Subscriptions. The features and price of each tier are shown in the Service. All fees are stated and payable in South African Rand (ZAR) and, unless stated otherwise, are inclusive of value-added tax where applicable. Where we are a registered VAT vendor, we will make a valid tax invoice available to you for each Subscription charge (see clause 6.11)."
        },
        {
          "type": "paragraph",
          "text": "6.2 Free trial. New users may be offered a free trial of 14 (fourteen) days. You may cancel at any time during the trial at no cost. We will send you a reminder (for example by email) at least 3 (three) days before the trial ends and the first fee is charged. If you do not cancel before the trial ends, your Subscription will automatically start and the applicable fee will become payable. We may change or withdraw trial offers at any time."
        },
        {
          "type": "paragraph",
          "text": "6.3 Payment gateway. Subscription fees are collected through Payfast. By subscribing, you authorise us, through Payfast, to charge your chosen payment method the applicable recurring monthly fee. Your card and payment details are handled by Payfast under its own terms and its own security arrangements; we do not store your full card number."
        },
        {
          "type": "paragraph",
          "text": "6.4 Auto-renewal. Your Subscription renews automatically each month, and the monthly fee is charged for each new month, until you cancel. Each renewal is for a further one-month period."
        },
        {
          "type": "paragraph",
          "text": "6.5 Cancellation. You may cancel your Subscription at any time through the Service or by contacting us at {{SUPPORT_EMAIL}}. When you cancel:"
        },
        {
          "type": "bullets",
          "items": [
            "6.5.1 your cancellation stops the next automatic renewal;",
            "6.5.2 you keep access to the paid features until the end of the month you have already paid for; and",
            "6.5.3 you will not receive a refund for the unused portion of that current paid month."
          ]
        },
        {
          "type": "paragraph",
          "text": "6.6 CPA and ECTA rights preserved. Clause 6.5.3 does not exclude, and nothing in these Terms excludes, any right to a refund or any other remedy that you have and that cannot lawfully be excluded under the CPA, the ECTA or other applicable law. Where such a right applies, it prevails to the extent of any inconsistency with these Terms."
        },
        {
          "type": "paragraph",
          "text": "6.7 Price changes. We may change Subscription prices from time to time. We will give you reasonable prior notice of any price change (for example by email or a notice in the Service) before it takes effect. If you do not accept a price change, your remedy is to cancel before it takes effect, in which case clause 6.5 applies."
        },
        {
          "type": "paragraph",
          "text": "6.8 Non-payment. If a payment fails or a Subscription fee is not paid when due, we may, after reasonable notice where practical:"
        },
        {
          "type": "bullets",
          "items": [
            "6.8.1 downgrade your Account to read-only access, so that you can still view and export your data but cannot create or edit records; and",
            "6.8.2 if the amount remains unpaid, suspend your Account."
          ]
        },
        {
          "type": "paragraph",
          "text": "Restoring full access after a downgrade or suspension may require you to bring your payments up to date."
        },
        {
          "type": "paragraph",
          "text": "6.9 Interest and costs. We may charge interest on overdue amounts at a rate not exceeding the maximum permitted by law, calculated from the due date until payment. Where you breach your payment obligations, we may recover our reasonable costs of collection and enforcement. Nothing in this clause entitles us to any charge that is not permitted under the CPA, the National Credit Act or other applicable law."
        },
        {
          "type": "paragraph",
          "text": "6.10 Taxes on your side. You are responsible for any taxes, levies or charges imposed on you in relation to your use of the Service, other than taxes on our income."
        },
        {
          "type": "paragraph",
          "text": "6.11 Access to your transaction records. You can access and download a record of each Subscription payment (and, where applicable, a tax invoice) within the Service, and payment records are also available through your Payfast account. These records remain available to you within the Service for at least as long as your Account is active and for a reasonable period after cancellation, so that you can retain a full record of your transactions with us."
        }
      ]
    },
    {
      "heading": "7. Cooling-off rights (ECTA section 44)",
      "blocks": [
        {
          "type": "paragraph",
          "text": "7.1 If you are a natural person (a \"consumer\" under the ECTA), you may have a statutory 7 (seven) day cooling-off right under section 44 of the ECTA for certain electronic transactions, allowing you to cancel without reason and without penalty (though you may be liable for the reasonable cost of returning anything)."
        },
        {
          "type": "paragraph",
          "text": "7.2 The Service is supplied to you electronically and begins as soon as you register and start using it (including during the free trial). By registering, starting the free trial, or otherwise asking us to make the Service available to you immediately, you agree to the performance of the Service beginning before any cooling-off period would end. Where the Service has begun with your consent in this way, any section 44 cooling-off right falls away in respect of the Service already provided, as contemplated by section 42(2) of the ECTA."
        },
        {
          "type": "paragraph",
          "text": "7.3 This Section does not take away any right you have that cannot lawfully be excluded. You can still cancel your Subscription at any time under clause 6.5, and clause 6.6 continues to apply."
        }
      ]
    },
    {
      "heading": "8. Acceptable use",
      "blocks": [
        {
          "type": "paragraph",
          "text": "8.1 You agree that you will not, and will not permit any Authorised User or anyone else to:"
        },
        {
          "type": "bullets",
          "items": [
            "8.1.1 use the Service for any unlawful, fraudulent or deceptive purpose, or in breach of any law (including POPIA);",
            "8.1.2 upload or process any personal information of another person unless you have a lawful basis to do so and are entitled to provide it to us for processing (see Section 9);",
            "8.1.3 upload or transmit any material that is unlawful, defamatory, infringing, or that contains viruses, malware or other harmful code;",
            "8.1.4 attempt to gain unauthorised access to the Service, other users' accounts, or our systems or networks;",
            "8.1.5 interfere with, disrupt, overload or impair the Service or the servers or networks that support it;",
            "8.1.6 copy, modify, reverse-engineer, decompile, disassemble, or attempt to derive the source code of the Service, except to the extent this restriction is prohibited by law;",
            "8.1.7 resell, sublicense, rent, or make the Service available to any third party except as expressly permitted (permitting your own Authorised Users under clause 5.6 is allowed), or use it to build or offer a competing product;",
            "8.1.8 use any automated means (such as scraping or bots) to access the Service other than through interfaces we provide; or",
            "8.1.9 remove, obscure or alter any proprietary notices in the Service."
          ]
        },
        {
          "type": "paragraph",
          "text": "8.2 We may investigate and take appropriate action, including suspension or termination under Section 20, where we reasonably believe you have breached this Section."
        }
      ]
    },
    {
      "heading": "9. User Content and data ownership",
      "blocks": [
        {
          "type": "paragraph",
          "text": "9.1 You own your data. As between you and us, you retain all rights in and ownership of your User Content. We do not claim ownership of it."
        },
        {
          "type": "paragraph",
          "text": "9.2 Licence to us. You grant us a non-exclusive, worldwide, royalty-free licence to host, store, copy, transmit, display, process and back up your User Content, and to make technical modifications necessary to do so, solely for the purposes of providing, maintaining, securing, supporting and improving the Service, and as further described in the Privacy Policy. This licence lasts for as long as we hold your User Content and ends when the User Content is deleted, subject to Section 20 and to any legal retention obligation."
        },
        {
          "type": "paragraph",
          "text": "9.3 Your responsibility for User Content. You are solely responsible for your User Content, including its accuracy, quality, legality and reliability, and for having all rights and permissions needed to upload and process it."
        },
        {
          "type": "paragraph",
          "text": "9.4 Third-party personal information. Much of the User Content you upload is personal information of other people — for example the names, contact details and addresses of your clients and suppliers, and (where you use payroll) your employees' full names, ID numbers, tax numbers and salaries, which is special personal information under POPIA. You warrant that, in respect of all such personal information:"
        },
        {
          "type": "bullets",
          "items": [
            "9.4.1 you have a lawful basis under POPIA to collect it and to provide it to us and to our Operators for processing;",
            "9.4.2 you have given any notices and obtained any consents required by law; and",
            "9.4.3 in respect of the Service, you act as the responsible party and we act as your Operator, processing that personal information on your behalf and on your documented instructions in order to provide the Service, on the terms set out in Section 10."
          ]
        },
        {
          "type": "paragraph",
          "text": "9.5 You must handle personal information you upload in accordance with POPIA. The Privacy Policy describes how we process personal information and should be read together with this Section."
        },
        {
          "type": "paragraph",
          "text": "9.6 We are not obliged to monitor or verify your User Content, but we may remove or disable access to User Content that we reasonably believe breaches these Terms or the law."
        }
      ]
    },
    {
      "heading": "10. Our data-processing (POPIA operator) obligations",
      "blocks": [
        {
          "type": "paragraph",
          "text": "10.1 Where you upload personal information into the Service, you are the responsible party and we act as your Operator under POPIA. This Section records our obligations to you as your Operator, as required by sections 19 to 21 of POPIA, and forms our written data-processing agreement with you. If you require a separate standalone data-processing addendum, contact {{SUPPORT_EMAIL}}."
        },
        {
          "type": "paragraph",
          "text": "10.2 We undertake that we will:"
        },
        {
          "type": "bullets",
          "items": [
            "10.2.1 process the personal information you upload only to provide, maintain, secure, support and improve the Service, and only on your documented instructions (which include these Terms, the Privacy Policy and your use of the Service's features), unless a law requires otherwise, in which case we will inform you where lawful to do so;",
            "10.2.2 apply appropriate, reasonable technical and organisational security measures to protect the personal information against loss, damage, unauthorised access and unlawful processing, as required by section 19 of POPIA;",
            "10.2.3 treat the personal information as confidential and ensure that our personnel who process it are bound by confidentiality obligations;",
            "10.2.4 notify you without undue delay after becoming aware of any security compromise affecting your personal information (as contemplated by section 22 of POPIA), so that you can meet your own notification obligations, and provide reasonable assistance in connection with the compromise;",
            "10.2.5 only engage the sub-operators listed in Section 15 (and any replacements notified under clause 15.5), and impose on each of them written obligations that are substantially equivalent to those in this Section; and",
            "10.2.6 at the end of the provision of the Service, return or securely delete or de-identify the personal information, subject to the legal-retention period described in clause 20.4."
          ]
        },
        {
          "type": "paragraph",
          "text": "10.3 We will provide you with reasonable assistance, taking into account the nature of the processing and the information available to us, to help you respond to requests from data subjects and to meet your own obligations under POPIA, including in relation to security, notifications and, where applicable, personal-information impact assessments."
        },
        {
          "type": "paragraph",
          "text": "10.4 Cross-border processing. Some of our Operators process personal information outside South Africa (in the European Union and the United States), as described in Section 15 and the Privacy Policy. You instruct and authorise us to transfer personal information to those Operators for the purpose of providing the Service. These transfers rely on the safeguards permitted by section 72 of POPIA, including that the transfer is necessary for the performance of our contract with you (and of contracts concluded in your interest), that each relevant Operator is bound by contractual terms providing an adequate level of protection, and/or that you consent to the transfer."
        }
      ]
    },
    {
      "heading": "11. Confidentiality",
      "blocks": [
        {
          "type": "paragraph",
          "text": "11.1 We recognise that your User Content and business information (including your financial records, bank-statement contents, tax numbers and payroll data) are confidential to you. We undertake to keep your User Content and non-public business information confidential, to use it only to provide, secure, support and improve the Service (and as set out in the Privacy Policy and Section 10), and not to sell it."
        },
        {
          "type": "paragraph",
          "text": "11.2 We may disclose your confidential information only: to our Operators and personnel who need it to provide the Service and who are bound by confidentiality obligations; where you instruct or authorise us to do so; or where required by law, a court, or a competent authority, in which case we will (where lawful and practical) give you notice."
        },
        {
          "type": "paragraph",
          "text": "11.3 This Section does not apply to information that is or becomes public other than through our breach, or that we are required by law to disclose. It survives termination of these Terms."
        }
      ]
    },
    {
      "heading": "12. Intellectual property",
      "blocks": [
        {
          "type": "paragraph",
          "text": "12.1 The Service, including all software, source code, design, layout, text, graphics, logos, the \"Worklog\" name and brand, and all other content we provide (excluding your User Content), is owned by us or our licensors and is protected by Intellectual Property laws."
        },
        {
          "type": "paragraph",
          "text": "12.2 Subject to your compliance with these Terms and payment of applicable fees, we grant you a limited, non-exclusive, non-transferable, non-sublicensable, revocable licence to access and use the Service for your own internal business purposes for the duration of your Subscription."
        },
        {
          "type": "paragraph",
          "text": "12.3 You obtain no rights in the Service other than the licence expressly granted in clause 12.2. All rights not expressly granted are reserved to us."
        },
        {
          "type": "paragraph",
          "text": "12.4 If you give us feedback or suggestions about the Service, we may use them without any obligation to you."
        }
      ]
    },
    {
      "heading": "13. No accounting, tax or financial advice",
      "blocks": [
        {
          "type": "paragraph",
          "text": "13.1 This is an important clause. Please read it carefully."
        },
        {
          "type": "paragraph",
          "text": "13.2 Worklog is a software tool for keeping records and producing estimates. It is not a registered accountant, auditor, tax practitioner, bookkeeper, or financial or legal adviser, and it does not provide accounting, auditing, tax, financial, investment, legal or other professional advice. Using the Service does not create any professional-client, advisory or fiduciary relationship between you and us."
        },
        {
          "type": "paragraph",
          "text": "13.3 All tax figures, SARS rates, calculations, estimates and returns-related outputs (including anything labelled or relating to VAT201, EMP201, PAYE, UIF, SDL, or provisional tax), and all documents the Service generates (including invoices, quotes and payslips), are provided for your convenience and as estimates only. They:"
        },
        {
          "type": "bullets",
          "items": [
            "13.3.1 may be incomplete, inaccurate, or out of date;",
            "13.3.2 may not reflect current law, current SARS rates, or your particular circumstances; and",
            "13.3.3 must be independently checked and verified by you, and where appropriate by a suitably qualified professional such as a registered tax practitioner or accountant, before you rely on them or submit anything to any authority."
          ]
        },
        {
          "type": "paragraph",
          "text": "13.4 Imported and processed data. The disclaimer in this Section also applies to all data that the Service imports, decrypts, parses, categorises, reconciles or otherwise processes from bank statements or any other source. Such processed data is a convenience transformation of your records; it may be incomplete or incorrect, may mis-read or mis-categorise entries, and must be checked by you against your own source documents before you rely on it. This is so whether or not the processing involved an AI Feature."
        },
        {
          "type": "paragraph",
          "text": "13.5 You remain solely responsible for:"
        },
        {
          "type": "bullets",
          "items": [
            "13.5.1 the accuracy and completeness of your records;",
            "13.5.2 all of your tax, statutory and regulatory compliance, including with SARS, the CIPC, the Department of Employment and Labour, and any other authority;",
            "13.5.3 the correct calculation, deduction, payment and submission of any tax, levy or return; and",
            "13.5.4 every decision you make and every action you take using, or based on, the Service or its outputs."
          ]
        },
        {
          "type": "paragraph",
          "text": "13.6 Your acknowledgement and assumption of risk. You acknowledge, agree and represent that: the Service does not provide advice of any kind; you will independently verify every tax figure, calculation, reconciliation and generated document, and will obtain advice from a registered tax practitioner, accountant or other suitably qualified professional where appropriate, before relying on it or submitting it to any authority; and you rely on the Service's outputs at your own risk. We may ask you to confirm this acknowledgement when you sign up or when you use particular features."
        },
        {
          "type": "paragraph",
          "text": "13.7 No duty to third parties. The Service is provided to you, not to any other person. We assume no duty of care to, and give no advice, warranty or assurance to, any third party who receives or relies on any output, calculation, estimate or document produced by the Service — including your employees (for example in relation to payslips or PAYE/UIF deductions), your clients or your suppliers (for example in relation to invoices or quotes), or any authority acting in respect of them. {{COMPANY_NAME}} accepts no responsibility or liability to any such third party arising from that reliance, and you are responsible for those outputs as between you and those third parties. This clause is supported by the indemnity in Section 18."
        },
        {
          "type": "paragraph",
          "text": "13.8 To the maximum extent permitted by law, we are not responsible or liable for any penalty, interest, assessment, loss, fine or other consequence arising from your reliance on the Service or its outputs, from any error or omission in them, or from your failure to meet any compliance obligation. This clause is subject to clause 17.6."
        }
      ]
    },
    {
      "heading": "14. AI-assisted features",
      "blocks": [
        {
          "type": "paragraph",
          "text": "14.1 The AI Features are powered by a third-party artificial-intelligence provider, Anthropic PBC (the developer of the \"Claude\" AI models), based in the United States."
        },
        {
          "type": "paragraph",
          "text": "14.2 To provide the AI Features, the text you submit to them — including transaction descriptions, natural-language entries, help queries, and the contents of bank statements you submit for parsing — is transmitted to and processed by the AI provider, including outside South Africa. This is a cross-border transfer of personal information, described further in Section 15, clause 10.4 and the Privacy Policy."
        },
        {
          "type": "paragraph",
          "text": "14.3 AI output can be wrong. Artificial intelligence is probabilistic and can produce results that are inaccurate, incomplete, misleading or entirely fabricated (\"hallucinated\"), even when they appear confident and plausible. Output from the AI Features:"
        },
        {
          "type": "bullets",
          "items": [
            "14.3.1 is generated automatically without human review by us;",
            "14.3.2 does not constitute advice of any kind (see Section 13); and",
            "14.3.3 must be reviewed and verified by you before you rely on it or act on it."
          ]
        },
        {
          "type": "paragraph",
          "text": "14.4 You are responsible for checking the accuracy of anything the AI Features produce, and for any decision you make based on it. To the maximum extent permitted by law and subject to clause 17.6, we are not liable for any loss arising from your reliance on AI Feature output."
        },
        {
          "type": "paragraph",
          "text": "14.5 You must not submit to the AI Features any information that you are not lawfully entitled to submit, or any information whose transfer to a third-party processor outside South Africa is prohibited."
        }
      ]
    },
    {
      "heading": "15. Third-party services and operators",
      "blocks": [
        {
          "type": "paragraph",
          "text": "15.1 The Service relies on third-party service providers (our Operators) to function, including:"
        },
        {
          "type": "bullets",
          "items": [
            "15.1.1 Supabase — database, authentication and file storage (hosted in the European Union, AWS eu-west-1, Ireland);",
            "15.1.2 Vercel Inc. — application hosting and content delivery (United States);",
            "15.1.3 Anthropic PBC — the AI provider powering the AI Features (United States);",
            "15.1.4 Payfast (Pty) Ltd — payment gateway for Subscriptions (South Africa); and",
            "15.1.5 Resend — transactional email delivery (United States)."
          ]
        },
        {
          "type": "paragraph",
          "text": "15.2 These providers are independent third parties. We select them with reasonable care and put appropriate contractual protections in place (including the equivalent obligations described in clause 10.2.5), as described in the Privacy Policy, but we do not control them."
        },
        {
          "type": "paragraph",
          "text": "15.3 To the maximum extent permitted by law and subject to clause 17.6, we are not liable for any loss or damage arising from the acts, omissions, outages, errors, security incidents or failures of any third-party provider. Your use of Payfast and of any other third party's own services may also be subject to that third party's own terms."
        },
        {
          "type": "paragraph",
          "text": "15.4 The Service may contain links to, or interoperate with, other third-party websites or services that we do not control. We are not responsible for them, and you access them at your own risk."
        },
        {
          "type": "paragraph",
          "text": "15.5 Changes to Operators. We may add, replace or remove Operators and sub-processors from time to time. We will keep the list of Operators in the Privacy Policy up to date and, for material changes (including the introduction of a new cross-border processor), will give reasonable notice by email or an in-app notice. We will impose substantially equivalent contractual protections on any new Operator. If you do not accept a change of Operator, your remedy is to cancel your Subscription under clause 6.5 before the change takes effect."
        }
      ]
    },
    {
      "heading": "16. Availability of the Service and warranties",
      "blocks": [
        {
          "type": "paragraph",
          "text": "16.1 The Service is provided on an \"as is\" and \"as available\" basis. Except for the rights you have under section 55 of the CPA (the right to services of a quality that persons are generally entitled to expect) and any other right or warranty that cannot lawfully be excluded, and to the maximum extent permitted by law, we give no warranties, express or implied, that the Service is fit for any particular purpose, is free of defects, or will meet your requirements."
        },
        {
          "type": "paragraph",
          "text": "16.2 To the maximum extent permitted by law and subject to clause 16.1, we do not warrant that the Service will be uninterrupted, timely, secure, error-free, or free of viruses or other harmful components, or that any defect will be corrected."
        },
        {
          "type": "paragraph",
          "text": "16.3 We may carry out maintenance, updates and repairs, and the Service may be unavailable or degraded during those times. We will try to schedule planned maintenance to minimise disruption and to give notice of significant planned downtime where practical."
        },
        {
          "type": "paragraph",
          "text": "16.4 You are responsible for keeping your own independent backups of important records. While we take reasonable measures to back up data, we do not guarantee against loss of User Content, and, subject to clause 17.6, we are not liable for any such loss."
        }
      ]
    },
    {
      "heading": "17. Limitation of liability",
      "blocks": [
        {
          "type": "paragraph",
          "text": "17.1 Nothing in these Terms limits or excludes any liability that cannot lawfully be limited or excluded. Clause 17.6 sets out important carve-outs, and these Terms must be read subject to it. If any exclusion or limitation in this Section would be unfair, unreasonable or unenforceable against you under the CPA or other applicable law, it applies only to the reduced extent (if any) that the law allows, and is read down rather than struck out entirely."
        },
        {
          "type": "paragraph",
          "text": "17.2 Subject to clause 17.6, to the maximum extent permitted by law, we are not liable to you for any indirect, incidental, special, consequential or punitive loss or damage, or for any loss of profits, loss of revenue, loss of anticipated savings, loss of business, loss of goodwill, or loss or corruption of data, in each case whether arising in contract, delict (including negligence), statute or otherwise, and whether or not such loss was foreseeable or we were advised of its possibility."
        },
        {
          "type": "paragraph",
          "text": "17.3 General cap. Subject to clauses 17.4 and 17.6, and to the maximum extent permitted by law, our total aggregate liability to you arising out of or in connection with these Terms and the Service, from all causes combined, is limited to the greater of: (a) the total Subscription fees actually paid by you to us in the 12 (twelve) months immediately before the event giving rise to the liability; or (b) R10,000 (ten thousand Rand)."
        },
        {
          "type": "paragraph",
          "text": "17.4 Higher cap for a personal-information compromise. Because the Service is built to hold sensitive and special personal information, and subject to clause 17.6, our total aggregate liability for loss you suffer arising from a compromise of the security or integrity of personal information held in the Service that is caused by our breach of these Terms or our negligence is limited to the greater of: (a) the total Subscription fees actually paid by you to us in the 12 (twelve) months immediately before the event; or (b) R50,000 (fifty thousand Rand). This higher cap replaces, and is not added to, the general cap in clause 17.3 for that category of loss."
        },
        {
          "type": "paragraph",
          "text": "17.5 The exclusions and limitations in this Section reflect a fair and reasonable allocation of risk between us, taking into account the price of the Service and the fact that you retain control of, and responsibility for, your records and your compliance. You acknowledge, without limiting Section 13, that we are not liable for any decision you make, or compliance obligation you fail to meet, in reliance on the Service or its outputs."
        },
        {
          "type": "paragraph",
          "text": "17.6 Rights and liabilities that cannot be excluded. Nothing in these Terms excludes, restricts or limits:"
        },
        {
          "type": "bullets",
          "items": [
            "17.6.1 our liability for death or personal injury caused by our negligence;",
            "17.6.2 our liability for loss caused by our own gross negligence or wilful misconduct;",
            "17.6.3 our liability for fraud or fraudulent misrepresentation; or",
            "17.6.4 any liability, or any of your rights, that cannot lawfully be excluded or limited under the CPA, the ECTA, POPIA or other applicable South African law."
          ]
        },
        {
          "type": "paragraph",
          "text": "Where any provision of these Terms would otherwise purport to exclude or limit such a liability or right, that provision does not apply to the extent the law does not allow it."
        }
      ]
    },
    {
      "heading": "18. Indemnity",
      "blocks": [
        {
          "type": "paragraph",
          "text": "18.1 To the extent permitted by law, you indemnify us (and our directors, employees, agents and Operators) against third-party claims, demands, liabilities, losses, damages, penalties, reasonable costs and expenses (including reasonable legal costs) that arise from your culpable breach of these Terms or of any law, or your unlawful, unauthorised or improper conduct, and specifically from:"
        },
        {
          "type": "bullets",
          "items": [
            "18.1.1 your breach of these Terms or of any law in connection with the Service;",
            "18.1.2 your unlawful, unauthorised or improper use of the Service, or that of your Authorised Users;",
            "18.1.3 any personal information you uploaded to or processed through the Service without a lawful basis, or in breach of POPIA or any other law, including any claim by a data subject or by the Information Regulator; and",
            "18.1.4 any claim by a third party (including your employees, clients, suppliers, or any authority acting in respect of them) arising from that third party's reliance on any output, calculation, estimate or document produced by the Service, except to the extent the claim is caused by our own gross negligence or wilful misconduct."
          ]
        },
        {
          "type": "paragraph",
          "text": "18.2 This indemnity does not apply, and you have no liability under it, to the extent that: the claim arises from our own gross negligence, wilful misconduct or breach of these Terms; the loss could reasonably have been avoided or mitigated by us; or the indemnity would be unfair, unreasonable or unenforceable against you under the CPA or other applicable law, in which case it is read down to what the law permits rather than being void in full."
        },
        {
          "type": "paragraph",
          "text": "18.3 The benefit of this indemnity, so far as it is expressed to be in favour of our directors, employees, agents and Operators, is stipulated for their benefit as a stipulatio alteri (a benefit created for a third party), which we accept on their behalf and which they may accept and enforce (see Section 19)."
        },
        {
          "type": "paragraph",
          "text": "18.4 We will notify you of any claim to which this indemnity may apply, and may, at our option, participate in its defence. You must not settle any such claim in a way that imposes any obligation or admission on us without our prior written consent, which will not be unreasonably withheld."
        }
      ]
    },
    {
      "heading": "19. Third-party beneficiaries (stipulatio alteri)",
      "blocks": [
        {
          "type": "paragraph",
          "text": "19.1 The exclusions and limitations of liability in Section 17, the no-duty-to-third-parties provision in clause 13.7, and the indemnities in Section 18, in each case so far as they are expressed to benefit our directors, employees, agents and Operators, are made for the benefit of those persons as a stipulatio alteri."
        },
        {
          "type": "paragraph",
          "text": "19.2 We accept those benefits on behalf of those persons, and each of them may accept and enforce the relevant benefit for their own account. We may, however, waive, compromise or deal with any of these Terms without needing the consent of any such third party."
        }
      ]
    },
    {
      "heading": "20. Suspension and termination",
      "blocks": [
        {
          "type": "paragraph",
          "text": "20.1 By you. You may stop using the Service and terminate these Terms at any time by cancelling your Subscription (clause 6.5) and closing your Account."
        },
        {
          "type": "paragraph",
          "text": "20.2 By us. We may suspend or terminate your access to the Service, in whole or in part, on reasonable notice, and immediately where reasonably necessary, if:"
        },
        {
          "type": "bullets",
          "items": [
            "20.2.1 you materially breach these Terms and, where the breach can be remedied, fail to remedy it within a reasonable period after we ask you to;",
            "20.2.2 you fail to pay fees when due (in which case clause 6.8 also applies);",
            "20.2.3 we are required to do so by law, or to protect the Service, other users, or third parties; or",
            "20.2.4 we decide to stop providing the Service generally, in which case we will give you as much notice as is reasonably practical."
          ]
        },
        {
          "type": "paragraph",
          "text": "20.3 Effect of termination. On termination or expiry of these Terms:"
        },
        {
          "type": "bullets",
          "items": [
            "20.3.1 your right to access and use the Service ends;",
            "20.3.2 for a reasonable period after termination (an \"export window\"), and where lawful and technically practical, we will make your User Content available for you to export, after which we may delete it; and",
            "20.3.3 we may retain and thereafter delete or de-identify User Content in accordance with clause 20.4, clause 10.2.6 and the Privacy Policy."
          ]
        },
        {
          "type": "paragraph",
          "text": "20.4 Retention. South African tax legislation generally requires business records to be kept for at least 5 (five) years. Accordingly, after your Account is closed we may retain your data for the period required or permitted by law, after which we will delete or de-identify it, except where a longer retention period is required or permitted by law. The Privacy Policy sets out how retention and deletion are handled."
        },
        {
          "type": "paragraph",
          "text": "20.5 Survival. Clauses that by their nature should survive termination (including clauses 9.3, 10.2.6, 11, 12, 13, 14.3–14.4, 15.3, 16.4, 17, 18, 19, 20.3–20.5, and 25–26) survive termination or expiry of these Terms."
        }
      ]
    },
    {
      "heading": "21. Changes to these Terms",
      "blocks": [
        {
          "type": "paragraph",
          "text": "21.1 We may amend these Terms from time to time, for example to reflect changes to the Service, to our Operators, or to the law."
        },
        {
          "type": "paragraph",
          "text": "21.2 We will publish the updated Terms in the Service and update the effective date. Where a change is material, we will give you reasonable notice (for example by email or an in-app notice) before it takes effect."
        },
        {
          "type": "paragraph",
          "text": "21.3 If you continue to use the Service after a change takes effect, you are bound by the updated Terms. If you do not accept a change, your remedy is to stop using the Service and cancel your Subscription (clause 6.5) before the change takes effect."
        }
      ]
    },
    {
      "heading": "22. Notices",
      "blocks": [
        {
          "type": "paragraph",
          "text": "22.1 We may give you notices relating to the Service by email to the address linked to your Account, by a notice within the Service, or by posting on our website. You are responsible for keeping your email address current. A notice we send you electronically is treated as received when it is capable of being retrieved and accessed by you (consistent with section 23 of the ECTA). A notice is presumed, unless the contrary is shown, to be capable of being retrieved on the day it is sent, except where we know or ought reasonably to know that it was not delivered."
        },
        {
          "type": "paragraph",
          "text": "22.2 You may give us formal legal notices by email to {{SUPPORT_EMAIL}} and, where we specify, also in writing to our registered address at {{REGISTERED_ADDRESS}}."
        },
        {
          "type": "paragraph",
          "text": "22.3 The parties choose the above addresses as their respective chosen addresses for the delivery of legal documents and notices (in law, their domicilium citandi et executandi). Either party may change its chosen address on written notice to the other."
        }
      ]
    },
    {
      "heading": "23. Governing law and jurisdiction",
      "blocks": [
        {
          "type": "paragraph",
          "text": "23.1 These Terms, and any dispute or matter arising out of or in connection with them or the Service, are governed by and construed in accordance with the law of the Republic of South Africa."
        },
        {
          "type": "paragraph",
          "text": "23.2 Subject to Section 24, you and we submit to the jurisdiction of the courts of {{GOVERNING_PROVINCE}} in respect of any dispute arising out of or in connection with these Terms. However, where you are a consumer whom the law entitles to be sued only in, or to approach, the court of the area in which you reside or carry on business, that right is preserved and this clause does not take it away. Nothing in this clause affects any right you may have under the CPA or other law to approach a court, tribunal, ombud, the National Consumer Commission or the Information Regulator with jurisdiction."
        }
      ]
    },
    {
      "heading": "24. Dispute resolution",
      "blocks": [
        {
          "type": "paragraph",
          "text": "24.1 If a dispute arises between you and us in connection with these Terms or the Service, both parties will first try to resolve it in good faith."
        },
        {
          "type": "paragraph",
          "text": "24.2 The party raising the dispute must notify the other in writing, setting out the nature of the dispute and the outcome sought. The parties (or their authorised representatives) will then meet or confer, in person or remotely, within a reasonable period, and use reasonable efforts to resolve the dispute by negotiation."
        },
        {
          "type": "paragraph",
          "text": "24.3 If the dispute is not resolved within 30 (thirty) days after the written notice, either party may pursue any remedy available to it, including litigation in accordance with Section 23."
        },
        {
          "type": "paragraph",
          "text": "24.4 This Section does not prevent either party from seeking urgent interim or interdictory relief from a court at any time, and does not limit any right you may have to complain to a regulator, ombud, the National Consumer Commission or the Information Regulator."
        }
      ]
    },
    {
      "heading": "25. General",
      "blocks": [
        {
          "type": "paragraph",
          "text": "25.1 Whole agreement. These Terms, together with the Privacy Policy and any tier or pricing details shown in the Service, constitute the entire agreement between you and us regarding the Service, and replace all prior understandings on the subject."
        },
        {
          "type": "paragraph",
          "text": "25.2 Severability. If any provision of these Terms is found to be invalid, unlawful or unenforceable, it will be severed or read down to the minimum extent necessary, and the remaining provisions will continue in full force."
        },
        {
          "type": "paragraph",
          "text": "25.3 No waiver. Our failure or delay in enforcing any provision of these Terms is not a waiver of that or any other provision, and no waiver is effective unless in writing."
        },
        {
          "type": "paragraph",
          "text": "25.4 Assignment. You may not cede, assign or transfer your rights or obligations under these Terms without our prior written consent. We may cede, assign or transfer our rights and obligations, including in connection with a merger, reorganisation, or sale of our business or assets, provided your rights under these Terms are not materially prejudiced."
        },
        {
          "type": "paragraph",
          "text": "25.5 No agency. Nothing in these Terms creates any partnership, joint venture, employment or agency relationship between you and us."
        },
        {
          "type": "paragraph",
          "text": "25.6 Force majeure. We are not liable for any failure or delay in performing our obligations to the extent it is caused by an event beyond our reasonable control, including load-shedding or power failure, failure of telecommunications or internet infrastructure, acts of God, natural disaster, fire, flood, epidemic or pandemic, war, civil unrest, strike, government action, or the failure of a third-party provider."
        },
        {
          "type": "paragraph",
          "text": "25.7 Interpretation. These Terms are not to be interpreted against a party merely because that party drafted them."
        }
      ]
    },
    {
      "heading": "26. Supplier and company details (ECTA section 43 disclosure)",
      "blocks": [
        {
          "type": "paragraph",
          "text": "26.1 As required by section 43 of the ECTA, the Service is provided by:"
        },
        {
          "type": "bullets",
          "items": [
            "Legal name: {{COMPANY_NAME}}",
            "Registration number: {{REG_NO}} (a private company incorporated in South Africa)",
            "Registered address: {{REGISTERED_ADDRESS}}",
            "Website address: {{WEBSITE_URL}}",
            "Support and legal email: {{SUPPORT_EMAIL}}",
            "Telephone / contact number: {{SUPPORT_PHONE}}",
            "POPIA Information Officer: {{INFO_OFFICER}}"
          ]
        },
        {
          "type": "paragraph",
          "text": "26.2 For questions about these Terms, your Account, billing, or the Service, please contact us at {{SUPPORT_EMAIL}} or {{SUPPORT_PHONE}}."
        },
        {
          "type": "paragraph",
          "text": "26.3 Record of your transaction. You can access, view and download a full record of your Subscription and each payment (including a tax invoice where applicable) within the Service, and payment records are also available through Payfast. These records remain available as described in clause 6.11, so that you can access and store a record of your transaction with us."
        },
        {
          "type": "paragraph",
          "text": "26.4 Security and privacy. Payment card details are handled securely by Payfast and we do not store your full card number. How we secure and process your personal information, your rights, our cross-border transfers, and how to complain to the Information Regulator (South Africa) are set out in our Privacy Policy, which forms part of these Terms."
        },
        {
          "type": "paragraph",
          "text": "26.5 Cooling-off, refunds and disputes. Your cooling-off position is explained in Section 7, your refund and cancellation rights in Section 6 (read with clause 6.6), and how disputes are handled in Sections 23 and 24."
        },
        {
          "type": "paragraph",
          "text": "By creating an Account or using Worklog, you confirm that you have read, understood and agree to these Terms of Service."
        }
      ]
    }
  ]
};
