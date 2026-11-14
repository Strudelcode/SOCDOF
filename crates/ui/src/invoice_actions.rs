//! Dunning letter, invoice mail and payment capture dialogs of the invoices screen.
//!
//! Ported from `DunningModal.tsx`, `InvoiceEmailModal.tsx`, `PaymentModal.tsx` and
//! `lib/emlGenerator.ts`. The dialogs only render; the rules live in `domain::dunning`,
//! `domain::mail` and `domain::payment`, and payments are stored through
//! [`Store::record_invoice_payment`].

use std::path::Path;

use egui::{Context, RichText};

use socdof_core::date::{format_iso8601, parse_iso8601};
use socdof_core::document_layout::DocumentLayout;
use socdof_core::docx::write_invoice_docx_with_template;
use socdof_core::domain::contact::Contact;
use socdof_core::domain::dunning::{self as dunning, DunningLetter, DunningLevel};
use socdof_core::domain::invoice::{Invoice, InvoiceStatus};
use socdof_core::domain::mail;
use socdof_core::domain::payment::{self, InvoicePayment, PaymentMethod};
use socdof_core::domain::settings::CompanyProfile;
use socdof_core::invoice_template::InvoiceTemplate;
use socdof_core::money::Money;
use socdof_core::pdf::din5008::write_invoice_pdf_with_layout_and_template;
use socdof_core::store::Store;

use crate::components::{button, modal, ButtonVariant};
use crate::controls::text_field;
use crate::focus::FocusState;
use crate::i18n::UiTexts;
use crate::theme::Theme;
use crate::tokens::FONT_SMALL;

/// Dialog that is currently open.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InvoiceAction {
    /// Dunning letter.
    Dunning,
    /// Mail draft of the invoice.
    Email,
    /// Payment capture.
    Payment,
    /// PDF print.
    Print,
}

/// Editable state of the four dialogs.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InvoiceActions {
    /// Open dialog.
    pub action: Option<InvoiceAction>,
    /// Dunning level.
    pub level: DunningLevel,
    /// Dunning fee as entered.
    pub fee: String,
    /// Default interest as entered.
    pub interest: String,
    /// Days until the new deadline.
    pub days: String,
    /// Mail recipient.
    pub recipient: String,
    /// Mail subject.
    pub subject: String,
    /// Mail body.
    pub body: String,
    /// Payment method index: 0 transfer, 1 cash, 2 card.
    pub method: usize,
    /// Booking date of a transfer (`yyyy-mm-dd`).
    pub date: String,
    /// Reference of a transfer.
    pub reference: String,
    /// Cash given by the customer.
    pub cash: String,
    /// Card type index.
    pub card_type: usize,
    /// Terminal receipt reference.
    pub trace: String,
    /// Target path of the PDF print.
    pub path: String,
    /// Target path of the Word export.
    pub docx_path: String,
    /// Message shown inside the dialog.
    pub notice: Option<String>,
}

impl Default for InvoiceActions {
    fn default() -> Self {
        InvoiceActions {
            action: None,
            level: DunningLevel::Reminder,
            fee: "0.00".to_string(),
            interest: "0.00".to_string(),
            days: DunningLevel::Reminder.deadline_days().to_string(),
            recipient: String::new(),
            subject: String::new(),
            body: String::new(),
            method: 0,
            date: String::new(),
            reference: String::new(),
            cash: String::new(),
            card_type: 0,
            trace: String::new(),
            path: String::new(),
            docx_path: String::new(),
            notice: None,
        }
    }
}

const CARD_TYPES: [(&str, &str); 4] = [
    ("girocard", "6759 1234 5678 9012"),
    ("visa", "4532 1234 5678 9012"),
    ("mastercard", "5412 1234 5678 9012"),
    ("applepay", "Apple Pay (NFC Tokenized)"),
];

impl InvoiceActions {
    /// Opens the dunning dialog with the defaults of the first level.
    pub fn open_dunning(&mut self, invoice: &Invoice, now: i64) {
        let letter = DunningLetter::new(DunningLevel::Reminder, invoice.total_gross(), now);
        self.level = letter.level;
        self.fee = cents_text(letter.fee);
        self.interest = cents_text(letter.interest);
        self.days = letter.days.to_string();
        self.notice = None;
        self.action = Some(InvoiceAction::Dunning);
    }

    /// Opens the mail draft with the legacy subject and body.
    pub fn open_email(
        &mut self,
        invoice: &Invoice,
        customer: &str,
        contact: Option<&Contact>,
        company: &CompanyProfile,
    ) {
        self.recipient = contact
            .and_then(|contact| contact.email.clone())
            .unwrap_or_default();
        self.subject = mail::invoice_subject(invoice, company);
        self.body = mail::invoice_body(invoice, customer, company);
        self.notice = None;
        self.action = Some(InvoiceAction::Email);
    }

    /// Opens the payment dialog.
    pub fn open_payment(&mut self, now: i64) {
        self.method = 0;
        self.date = today(now);
        self.reference.clear();
        self.cash.clear();
        self.card_type = 0;
        self.trace.clear();
        self.notice = None;
        self.action = Some(InvoiceAction::Payment);
    }

    /// Opens the print dialog with a safe default file name.
    pub fn open_print(&mut self, invoice: &Invoice) {
        self.path = default_pdf_path(&invoice.number);
        self.docx_path = default_pdf_path(&invoice.number).replace(".pdf", ".docx");
        self.notice = None;
        self.action = Some(InvoiceAction::Print);
    }

    /// Applies the presets of a dunning level, like the level tabs of the modal.
    pub fn select_level(&mut self, level: DunningLevel, total: Money, now: i64) {
        let letter = DunningLetter::new(level, total, now);
        self.level = level;
        self.fee = cents_text(letter.fee);
        self.interest = cents_text(letter.interest);
        self.days = letter.days.to_string();
    }

    /// Letter as currently configured.
    pub fn letter(&self, _total: Money, now: i64) -> DunningLetter {
        let days = self
            .days
            .trim()
            .parse::<i64>()
            .unwrap_or(self.level.deadline_days());
        DunningLetter {
            level: self.level,
            fee: parse_money(&self.fee),
            interest: parse_money(&self.interest),
            days,
            deadline: now + days.max(0) * dunning::DAY_MS,
        }
    }

    /// Payment described by the dialog.
    pub fn payment(&self, invoice: &Invoice, company: &CompanyProfile, now: i64) -> InvoicePayment {
        match self.method {
            1 => {
                let mut payment = InvoicePayment::new(
                    invoice.id,
                    PaymentMethod::Cash,
                    now,
                    payment::CASH_REFERENCE.to_string(),
                );
                payment.tse_signature = Some(payment::tse_signature(now));
                payment
            }
            2 => {
                let (card_type, number) = CARD_TYPES[self.card_type.min(CARD_TYPES.len() - 1)];
                let masked = payment::mask_card_number(number);
                let auth = if self.trace.trim().is_empty() {
                    format!("AUTH-{}", payment::base36(now.max(0) as u64).to_uppercase())
                } else {
                    self.trace.trim().to_string()
                };
                InvoicePayment::new(
                    invoice.id,
                    PaymentMethod::Card,
                    now,
                    payment::card_reference(&company.card_terminal_name, card_type, &masked, &auth),
                )
            }
            _ => InvoicePayment::new(
                invoice.id,
                PaymentMethod::Transfer,
                self.booking_date(now),
                payment::transfer_reference(&self.reference, &company.bank_name),
            ),
        }
    }

    /// Booking date of a transfer, falling back to today.
    pub fn booking_date(&self, now: i64) -> i64 {
        let text = self.date.trim();
        if text.len() == 10 {
            parse_iso8601(&format!("{text}T00:00:00Z")).unwrap_or(now)
        } else {
            now
        }
    }

    /// Change of the cash dialog.
    pub fn change(&self, total: Money) -> Money {
        payment::change_due(total, parse_money(&self.cash))
    }
}

fn parse_money(text: &str) -> Money {
    Money::parse(text.trim()).unwrap_or(Money::ZERO)
}

fn cents_text(money: Money) -> String {
    money.to_decimal_string()
}

fn today(now: i64) -> String {
    let stamp = format_iso8601(now);
    stamp.get(0..10).unwrap_or_default().to_string()
}

fn default_pdf_path(number: &str) -> String {
    let safe: String = number
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || character == '-' || character == '_' {
                character
            } else {
                '-'
            }
        })
        .collect();
    format!("Rechnung-{safe}.pdf")
}

/// Invoice, customer and store data the invoice dialogs need.
pub struct DialogData<'a> {
    /// Invoice the dialog works on.
    pub invoice: &'a Invoice,
    /// Customer display name used in the letter and the mail.
    pub customer: &'a str,
    /// Recipient contact of the invoice.
    pub contact: Option<&'a Contact>,
    /// Company profile with bank and mail data.
    pub company: &'a CompanyProfile,
    /// Store that receives the payment record.
    pub store: &'a Store,
    /// Current timestamp in milliseconds.
    pub now: i64,
    /// Active print template.
    pub template: &'a InvoiceTemplate,
    /// Stored letterhead layout used for printing.
    pub layout: &'a DocumentLayout,
}

/// Renders the open dialog and returns the status the caller has to store.
pub fn dialogs(
    ctx: &Context,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    actions: &mut InvoiceActions,
    data: &DialogData<'_>,
) -> Option<InvoiceStatus> {
    let action = actions.action?;
    let DialogData {
        invoice,
        customer,
        contact,
        company,
        store,
        now,
        template,
        layout,
    } = *data;
    let mut open = true;
    let mut close = false;
    let mut status = None;

    match action {
        InvoiceAction::Dunning => {
            let letter = actions.letter(invoice.total_gross(), now);
            let mut level = actions.level;
            modal(
                ctx,
                theme,
                &mut open,
                texts.get("invoices_dunning_title"),
                |ui| {
                    ui.horizontal(|ui| {
                        for candidate in DunningLevel::all() {
                            let variant = if candidate == level {
                                ButtonVariant::Primary
                            } else {
                                ButtonVariant::Ghost
                            };
                            if button(ui, theme, focus, &level_label(texts, candidate), variant)
                                .activated
                            {
                                level = candidate;
                            }
                        }
                    });
                    if level != actions.level {
                        actions.select_level(level, invoice.total_gross(), now);
                    }
                    ui.add_space(8.0);
                    ui.label(
                        RichText::new(format!(
                            "{} · {}",
                            invoice.number,
                            texts.get("invoices_dunning_overdue")
                        ))
                        .size(FONT_SMALL)
                        .color(theme.palette.text_muted),
                    );
                    ui.add_space(6.0);
                    text_field(
                        ui,
                        theme,
                        focus,
                        &mut actions.fee,
                        texts.get("invoices_dunning_fee"),
                        "0.00",
                        None,
                    );
                    text_field(
                        ui,
                        theme,
                        focus,
                        &mut actions.interest,
                        texts.get("invoices_dunning_interest"),
                        "0.00",
                        None,
                    );
                    text_field(
                        ui,
                        theme,
                        focus,
                        &mut actions.days,
                        texts.get("invoices_dunning_days"),
                        "7",
                        None,
                    );
                    ui.add_space(10.0);
                    ui.label(RichText::new(letter.level.title()).strong());
                    ui.label(
                        RichText::new(letter.level.intro(&letter.deadline_text())).size(FONT_SMALL),
                    );
                    ui.add_space(6.0);
                    for (label, amount) in [
                        ("invoices_total_gross", invoice.total_gross()),
                        ("invoices_dunning_fee_row", letter.fee),
                        ("invoices_dunning_interest_row", letter.interest),
                        (
                            "invoices_dunning_claim",
                            letter.total(invoice.total_gross()),
                        ),
                    ] {
                        ui.horizontal(|ui| {
                            ui.label(
                                RichText::new(texts.get(label))
                                    .size(FONT_SMALL)
                                    .color(theme.palette.text_muted),
                            );
                            ui.label(
                                RichText::new(format!(
                                    "{} {}",
                                    amount.to_decimal_string(),
                                    invoice.currency_symbol
                                ))
                                .strong(),
                            );
                        });
                    }
                    if let Some(note) = &actions.notice {
                        ui.add_space(6.0);
                        ui.label(RichText::new(note.clone()).size(FONT_SMALL));
                    }
                    ui.add_space(10.0);
                    ui.horizontal(|ui| {
                        if button(
                            ui,
                            theme,
                            focus,
                            texts.get("invoices_dunning_copy_eml"),
                            ButtonVariant::Secondary,
                        )
                        .activated
                        {
                            let eml = letter.eml(
                                contact
                                    .and_then(|contact| contact.email.clone())
                                    .unwrap_or_default()
                                    .as_str(),
                                &invoice.number,
                                invoice.total_gross(),
                                invoice.due_at,
                                &invoice.currency_symbol,
                                company,
                            );
                            ctx.output_mut(|output| output.copied_text = eml);
                            actions.notice = Some(texts.get("invoices_dunning_copied").to_string());
                        }
                        if button(
                            ui,
                            theme,
                            focus,
                            texts.get("invoices_dunning_execute"),
                            ButtonVariant::Primary,
                        )
                        .activated
                        {
                            close = true;
                        }
                        if button(
                            ui,
                            theme,
                            focus,
                            texts.get("invoices_close"),
                            ButtonVariant::Ghost,
                        )
                        .activated
                        {
                            close = true;
                        }
                    });
                    close
                },
            );
        }
        InvoiceAction::Email => {
            modal(
                ctx,
                theme,
                &mut open,
                texts.get("invoices_mail_title"),
                |ui| {
                    ui.label(
                        RichText::new(format!("{} · {}", invoice.number, customer))
                            .size(FONT_SMALL)
                            .color(theme.palette.text_muted),
                    );
                    ui.add_space(6.0);
                    text_field(
                        ui,
                        theme,
                        focus,
                        &mut actions.recipient,
                        texts.get("invoices_mail_recipient"),
                        "kunde@beispiel.de",
                        None,
                    );
                    text_field(
                        ui,
                        theme,
                        focus,
                        &mut actions.subject,
                        texts.get("invoices_mail_subject"),
                        "",
                        None,
                    );
                    ui.add_space(6.0);
                    ui.label(
                        RichText::new(texts.get("invoices_mail_body"))
                            .size(FONT_SMALL)
                            .color(theme.palette.text_muted),
                    );
                    ui.add(
                        egui::TextEdit::multiline(&mut actions.body)
                            .desired_rows(8)
                            .desired_width(520.0),
                    );
                    if let Some(note) = &actions.notice {
                        ui.add_space(6.0);
                        ui.label(RichText::new(note.clone()).size(FONT_SMALL));
                    }
                    ui.add_space(10.0);
                    ui.horizontal(|ui| {
                        if button(
                            ui,
                            theme,
                            focus,
                            texts.get("invoices_mail_copy_mailto"),
                            ButtonVariant::Secondary,
                        )
                        .activated
                        {
                            let url = mail::mailto_url(
                                &actions.recipient,
                                &actions.subject,
                                &actions.body,
                            );
                            ctx.output_mut(|output| output.copied_text = url);
                            actions.notice = Some(texts.get("invoices_mail_copied").to_string());
                        }
                        if button(
                            ui,
                            theme,
                            focus,
                            texts.get("invoices_mail_copy_eml"),
                            ButtonVariant::Secondary,
                        )
                        .activated
                        {
                            let eml =
                                mail::invoice_eml(invoice, customer, &actions.recipient, company);
                            ctx.output_mut(|output| output.copied_text = eml);
                            actions.notice = Some(texts.get("invoices_mail_copied").to_string());
                        }
                        if invoice.status != InvoiceStatus::Paid
                            && button(
                                ui,
                                theme,
                                focus,
                                texts.get("invoices_mail_mark_sent"),
                                ButtonVariant::Primary,
                            )
                            .activated
                        {
                            status = Some(InvoiceStatus::Sent);
                            close = true;
                        }
                        if button(
                            ui,
                            theme,
                            focus,
                            texts.get("invoices_close"),
                            ButtonVariant::Ghost,
                        )
                        .activated
                        {
                            close = true;
                        }
                    });
                    close
                },
            );
        }
        InvoiceAction::Payment => {
            let total = invoice.total_gross();
            let mut method = actions.method;
            modal(
                ctx,
                theme,
                &mut open,
                texts.get("invoices_payment_title"),
                |ui| {
                    ui.label(
                        RichText::new(format!(
                            "{} · {} {}{}",
                            invoice.number,
                            total.to_decimal_string(),
                            invoice.currency_symbol,
                            ""
                        ))
                        .size(FONT_SMALL)
                        .color(theme.palette.text_muted),
                    );
                    ui.add_space(8.0);
                    ui.horizontal(|ui| {
                        for (index, key) in [
                            "invoices_payment_transfer",
                            "invoices_payment_cash",
                            "invoices_payment_card",
                        ]
                        .iter()
                        .enumerate()
                        {
                            let variant = if index == method {
                                ButtonVariant::Primary
                            } else {
                                ButtonVariant::Ghost
                            };
                            if button(ui, theme, focus, texts.get(key), variant).activated {
                                method = index;
                            }
                        }
                    });
                    actions.method = method;
                    ui.add_space(8.0);

                    match method {
                        1 => {
                            text_field(
                                ui,
                                theme,
                                focus,
                                &mut actions.cash,
                                texts.get("invoices_payment_given"),
                                "0.00",
                                None,
                            );
                            ui.label(
                                RichText::new(format!(
                                    "{} {} {}",
                                    texts.get("invoices_payment_change"),
                                    actions.change(total).to_decimal_string(),
                                    invoice.currency_symbol
                                ))
                                .strong(),
                            );
                            ui.horizontal(|ui| {
                                for amount in payment::cash_quick_amounts(total) {
                                    let label = format!(
                                        "{} {}",
                                        amount.to_decimal_string(),
                                        invoice.currency_symbol
                                    );
                                    if button(ui, theme, focus, &label, ButtonVariant::Secondary)
                                        .activated
                                    {
                                        actions.cash = amount.to_decimal_string();
                                    }
                                }
                            });
                        }
                        2 => {
                            if !company.card_payment_enabled {
                                ui.label(
                                    RichText::new(texts.get("invoices_payment_card_unconfigured"))
                                        .size(FONT_SMALL)
                                        .color(theme.palette.danger),
                                );
                            }
                            ui.horizontal(|ui| {
                                for (index, (name, _)) in CARD_TYPES.iter().enumerate() {
                                    let variant = if index == actions.card_type {
                                        ButtonVariant::Primary
                                    } else {
                                        ButtonVariant::Ghost
                                    };
                                    if button(ui, theme, focus, name, variant).activated {
                                        actions.card_type = index;
                                    }
                                }
                            });
                            let (_, number) =
                                CARD_TYPES[actions.card_type.min(CARD_TYPES.len() - 1)];
                            ui.label(
                                RichText::new(payment::mask_card_number(number))
                                    .size(FONT_SMALL)
                                    .strong(),
                            );
                            text_field(
                                ui,
                                theme,
                                focus,
                                &mut actions.trace,
                                texts.get("invoices_payment_trace"),
                                "TRACE-89210",
                                None,
                            );
                        }
                        _ => {
                            text_field(
                                ui,
                                theme,
                                focus,
                                &mut actions.date,
                                texts.get("invoices_payment_date"),
                                "2026-01-31",
                                None,
                            );
                            text_field(
                                ui,
                                theme,
                                focus,
                                &mut actions.reference,
                                texts.get("invoices_payment_reference"),
                                "Kontoauszug 42",
                                None,
                            );
                        }
                    }

                    if let Some(note) = &actions.notice {
                        ui.add_space(6.0);
                        ui.label(RichText::new(note.clone()).size(FONT_SMALL));
                    }
                    ui.add_space(10.0);
                    ui.horizontal(|ui| {
                        if button(
                            ui,
                            theme,
                            focus,
                            texts.get("invoices_payment_confirm"),
                            ButtonVariant::Primary,
                        )
                        .activated
                        {
                            let payment = actions.payment(invoice, company, now);
                            match store.record_invoice_payment(&payment) {
                                Ok(()) => {
                                    status = Some(InvoiceStatus::Paid);
                                    close = true;
                                }
                                Err(error) => {
                                    actions.notice = Some(error.to_string());
                                }
                            }
                        }
                        if button(
                            ui,
                            theme,
                            focus,
                            texts.get("invoices_close"),
                            ButtonVariant::Ghost,
                        )
                        .activated
                        {
                            close = true;
                        }
                    });
                    close
                },
            );
        }
        InvoiceAction::Print => {
            modal(
                ctx,
                theme,
                &mut open,
                texts.get("invoices_print_title"),
                |ui| {
                    ui.label(
                        RichText::new(format!("{} · {}", invoice.number, template.name)).strong(),
                    );
                    ui.label(
                        RichText::new(format!(
                            "{}: {}",
                            texts.get("invoices_print_template"),
                            template.name
                        ))
                        .size(FONT_SMALL)
                        .color(theme.palette.text_muted),
                    );
                    ui.add_space(6.0);
                    text_field(
                        ui,
                        theme,
                        focus,
                        &mut actions.path,
                        texts.get("invoices_print_path"),
                        "Rechnung.pdf",
                        None,
                    );
                    text_field(
                        ui,
                        theme,
                        focus,
                        &mut actions.docx_path,
                        texts.get("invoices_word_save"),
                        "Rechnung.docx",
                        None,
                    );
                    ui.label(
                        RichText::new(format!(
                            "{}: {} · {}",
                            texts.get("invoices_print_due_days"),
                            template.due_days,
                            if template.show_fold_marks {
                                texts.get("invoices_print_fold_on")
                            } else {
                                texts.get("invoices_print_fold_off")
                            }
                        ))
                        .size(FONT_SMALL)
                        .color(theme.palette.text_muted),
                    );
                    if let Some(note) = &actions.notice {
                        ui.add_space(6.0);
                        ui.label(RichText::new(note.clone()).size(FONT_SMALL));
                    }
                    ui.add_space(10.0);
                    ui.horizontal(|ui| {
                        if button(
                            ui,
                            theme,
                            focus,
                            texts.get("invoices_print_save"),
                            ButtonVariant::Primary,
                        )
                        .activated
                        {
                            let mut path = actions.path.trim().to_string();
                            if path.is_empty() {
                                actions.notice =
                                    Some(texts.get("invoices_print_error_path").to_string());
                            } else {
                                if !path.to_ascii_lowercase().ends_with(".pdf") {
                                    path.push_str(".pdf");
                                }
                                actions.path = path.clone();
                                match contact {
                                    Some(contact) => {
                                        match write_invoice_pdf_with_layout_and_template(
                                            Path::new(&path),
                                            invoice,
                                            contact,
                                            company,
                                            layout,
                                            template,
                                        ) {
                                            Ok(()) => {
                                                actions.notice = Some(format!(
                                                    "{} {}",
                                                    texts.get("invoices_print_saved"),
                                                    path
                                                ));
                                            }
                                            Err(error) => {
                                                actions.notice = Some(format!(
                                                    "{}: {error}",
                                                    texts.get("invoices_print_error_save")
                                                ));
                                            }
                                        }
                                    }
                                    None => {
                                        actions.notice = Some(
                                            texts.get("invoices_print_error_contact").to_string(),
                                        );
                                    }
                                }
                            }
                        }
                        if button(
                            ui,
                            theme,
                            focus,
                            texts.get("invoices_word_save"),
                            ButtonVariant::Secondary,
                        )
                        .activated
                        {
                            let mut path = actions.docx_path.trim().to_string();
                            if path.is_empty() {
                                actions.notice =
                                    Some(texts.get("invoices_print_error_path").to_string());
                            } else {
                                if !path.to_ascii_lowercase().ends_with(".docx") {
                                    path.push_str(".docx");
                                }
                                actions.docx_path = path.clone();
                                match contact {
                                    Some(contact) => match write_invoice_docx_with_template(
                                        Path::new(&path),
                                        invoice,
                                        contact,
                                        company,
                                        template,
                                    ) {
                                        Ok(()) => {
                                            actions.notice = Some(format!(
                                                "{} {}",
                                                texts.get("invoices_word_saved"),
                                                path
                                            ));
                                        }
                                        Err(error) => {
                                            actions.notice = Some(format!(
                                                "{}: {error}",
                                                texts.get("invoices_word_error")
                                            ));
                                        }
                                    },
                                    None => {
                                        actions.notice = Some(
                                            texts.get("invoices_print_error_contact").to_string(),
                                        );
                                    }
                                }
                            }
                        }
                        if button(
                            ui,
                            theme,
                            focus,
                            texts.get("invoices_close"),
                            ButtonVariant::Ghost,
                        )
                        .activated
                        {
                            close = true;
                        }
                    });
                    close
                },
            );
        }
    }

    if !open || close {
        actions.action = None;
    }
    status
}

fn level_label(texts: &UiTexts, level: DunningLevel) -> String {
    format!("{} {}", texts.get("invoices_dunning_level"), level.number())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::theme::Appearance;
    use uuid::Uuid;

    fn invoice() -> Invoice {
        use socdof_core::domain::invoice::InvoiceLine;
        Invoice {
            id: Uuid::nil(),
            number: "2026-0001".to_string(),
            contact_id: Uuid::nil(),
            status: InvoiceStatus::Sent,
            issued_at: 1_760_000_000_000,
            due_at: 1_760_000_000_000 - 10 * dunning::DAY_MS,
            currency_symbol: "€".to_string(),
            note: None,
            tax_total_override_cents: None,
            lines: vec![InvoiceLine {
                description: "Beratung".to_string(),
                quantity_milli: 1_000,
                unit_price: Money::from_cents(10_000),
                tax_rate_bp: 1900,
            }],
        }
    }

    fn company() -> CompanyProfile {
        CompanyProfile {
            name: "Beispiel GmbH".to_string(),
            iban: "DE12 3456".to_string(),
            bank_name: "Beispielbank".to_string(),
            ..CompanyProfile::default()
        }
    }

    #[test]
    fn level_presets_fill_the_dialog() {
        let now = 1_760_000_000_000;
        let mut actions = InvoiceActions::default();
        actions.open_dunning(&invoice(), now);
        assert_eq!(actions.action, Some(InvoiceAction::Dunning));
        assert_eq!(actions.fee, "0.00");
        assert_eq!(actions.days, "7");

        actions.select_level(DunningLevel::Last, invoice().total_gross(), now);
        assert_eq!(actions.fee, "5.00");
        assert_eq!(actions.interest, "5.95");
        assert_eq!(actions.days, "5");
        let letter = actions.letter(invoice().total_gross(), now);
        assert_eq!(letter.deadline, now + 5 * dunning::DAY_MS);
        assert_eq!(
            letter.total(invoice().total_gross()),
            Money::from_cents(12_995)
        );
    }

    #[test]
    fn payment_dialog_builds_all_three_methods() {
        let now = 1_760_000_000_000;
        let invoice = invoice();
        let company = company();
        let mut actions = InvoiceActions::default();

        actions.open_payment(now);
        actions.reference = "Kontoauszug 42".to_string();
        actions.date = "2026-01-31".to_string();
        let transfer = actions.payment(&invoice, &company, now);
        assert_eq!(transfer.method, PaymentMethod::Transfer);
        assert_eq!(transfer.reference, "Banküberweisung (Kontoauszug 42)");
        assert_ne!(transfer.paid_at, now);

        actions.method = 1;
        let cash = actions.payment(&invoice, &company, now);
        assert_eq!(cash.method, PaymentMethod::Cash);
        assert_eq!(cash.reference, "Barzahlung Kasse");
        assert!(cash.tse_signature.unwrap().starts_with("CASH-TSE-"));

        actions.method = 2;
        actions.card_type = 1;
        actions.trace = "TRACE-1".to_string();
        let card = actions.payment(&invoice, &company, now);
        assert_eq!(card.method, PaymentMethod::Card);
        assert!(card
            .reference
            .contains("VISA 4532 **** **** **** / TRACE-1"));

        actions.trace.clear();
        assert!(actions
            .payment(&invoice, &company, now)
            .reference
            .contains("AUTH-"));
    }

    #[test]
    fn cash_dialog_computes_the_change() {
        let mut actions = InvoiceActions::default();
        actions.open_payment(0);
        actions.cash = "50.00".to_string();
        assert_eq!(
            actions.change(Money::from_cents(2_000)),
            Money::from_cents(3_000)
        );
    }

    #[test]
    fn print_dialog_uses_a_safe_default_path() {
        let mut actions = InvoiceActions::default();
        actions.open_print(&invoice());
        assert_eq!(actions.action, Some(InvoiceAction::Print));
        assert_eq!(actions.path, "Rechnung-2026-0001.pdf");
    }

    #[test]
    fn dialogs_render_all_three_actions() {
        let store = Store::open_in_memory().expect("store");
        let mut contact = Contact::new(
            socdof_core::domain::contact::ContactKind::Company,
            1_760_000_000_000,
        );
        contact.company_name = Some("Kunde".to_string());
        store.insert_contact(&contact).expect("contact");
        let mut draft = invoice();
        draft.contact_id = contact.id;
        store.insert_invoice(&draft).expect("invoice");
        let texts =
            UiTexts::embedded(socdof_core::domain::settings::Language::De).expect("catalogue");
        let theme = Theme::new(Appearance::Light, "indigo");
        let ctx = crate::theme::headless_context();
        let mut actions = InvoiceActions::default();
        actions.open_dunning(&invoice(), 1_760_000_000_000);

        let painted = paint(&ctx, &mut actions, &store, &theme, &texts);
        assert!(painted.contains(texts.get("invoices_dunning_title")));
        assert!(painted.contains("Zahlungserinnerung"));

        actions.open_email(&invoice(), "Kunde", None, &company());
        let painted = paint(&ctx, &mut actions, &store, &theme, &texts);
        assert!(painted.contains(texts.get("invoices_mail_title")));
        assert!(painted.contains("Rechnung 2026-0001"));

        actions.open_payment(1_760_000_000_000);
        let painted = paint(&ctx, &mut actions, &store, &theme, &texts);
        assert!(painted.contains(texts.get("invoices_payment_title")));
        assert!(painted.contains(texts.get("invoices_payment_transfer")));
    }

    fn paint(
        ctx: &Context,
        actions: &mut InvoiceActions,
        store: &Store,
        theme: &Theme,
        texts: &UiTexts,
    ) -> String {
        let invoice = invoice();
        let company = company();
        let template = socdof_core::invoice_template::default_template();
        let layout = socdof_core::document_layout::DocumentLayout::default();
        let mut focus = FocusState::default();
        let input = egui::RawInput {
            screen_rect: Some(egui::Rect::from_min_size(
                egui::Pos2::ZERO,
                egui::Vec2::new(1_200.0, 1_600.0),
            )),
            ..Default::default()
        };
        let mut frame = |ctx: &Context| {
            dialogs(
                ctx,
                theme,
                texts,
                &mut focus,
                actions,
                &DialogData {
                    invoice: &invoice,
                    customer: "Kunde",
                    contact: None,
                    company: &company,
                    store,
                    now: 1_760_000_000_000,
                    template: &template,
                    layout: &layout,
                },
            );
        };
        // egui lays a window out on the first frame and paints it on the next one.
        let _ = ctx.run(input.clone(), &mut frame);
        let output = ctx.run(input, &mut frame);
        crate::snapshot::signature(&output).join("\n")
    }
}
