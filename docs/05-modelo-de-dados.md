# Modelo de dados

## Entidades principais

### users (view read-only do schema `auth`, dono: saga)

O sgrf **lê** `auth.users`, nunca escreve: quem cria a identidade é o saga no primeiro
login. Não existe coluna de senha, de hash, de `must_change_password` nem de contadores de
tentativa — T10.

| Campo | Tipo | Regra |
|-------|------|-------|
| id | UUID | chave primária |
| login | texto | institucional (fonte da identidade) |
| name | texto | opcional (preenchido na tela de perfil do saga) |
| email | texto | opcional, institucional |
| role_base | texto | inferido pelo saga (`^a\d+$` → ALUNO) |

### user_roles (schema `sgrf`, dono: sgrf)

Papel **por sistema**. O claim `role` do JWT nunca é usado.

| Campo | Tipo | Regra |
|-------|------|-------|
| user_id | UUID | referência a `auth.users` (só leitura) |
| role | texto | ADMINISTRADOR / CHEFE_DEPARTAMENTO / CONSELHEIRO / PROFESSOR / ALUNO |
| status | enum | ativo/inativo |

### department_settings

| Campo | Tipo |
|-------|------|
| id | UUID |
| automatic_approval_limit_cents | inteiro |
| currency | enum |
| current_exchange_rate | decimal |
| daily_allowance_information | texto |
| voting_duration_hours | inteiro |
| view_extension_hours | inteiro |
| max_view_requests | inteiro |
| updated_by | UUID |
| updated_at | datetime |

### fund_balances

| Campo | Tipo |
|-------|------|
| id | UUID |
| reference_year | inteiro |
| available_cents | inteiro |
| provisioned_cents | inteiro |
| spent_cents | inteiro |
| version | inteiro |
| updated_by | UUID |
| updated_at | datetime |

O campo version deve ser usado para controle de concorrência otimista.

### resource_requests

| Campo | Tipo |
|-------|------|
| id | UUID |
| requester_id | UUID |
| type | enum |
| title | texto |
| justification | texto |
| status | enum |
| reference_year | inteiro |
| requested_amount_cents | inteiro |
| approved_amount_cents | inteiro |
| original_currency | enum |
| exchange_rate | decimal |
| converted_amount_cents | inteiro |
| submitted_at | datetime |
| voting_deadline_at | datetime |
| decided_at | datetime |
| created_at | datetime |
| updated_at | datetime |

### request_details_equipment

| Campo | Tipo |
|-------|------|
| request_id | UUID |
| technical_specification | texto |
| estimated_value_cents | inteiro |

### request_details_publication

| Campo | Tipo |
|-------|------|
| request_id | UUID |
| article_title | texto |
| article_pdf_file_id | UUID |
| acceptance_letter_file_id | UUID |
| publication_fee_cents | inteiro |

### request_details_travel

| Campo | Tipo |
|-------|------|
| request_id | UUID |
| reason | texto |
| destination | texto |
| consulted_other_sources | booleano |
| consulted_sources | texto |
| daily_count | inteiro |
| daily_rate_cents | inteiro |
| passage_amount_cents | inteiro |
| currency | enum |
| exchange_rate_snapshot | decimal |

### request_details_student_aid

| Campo | Tipo |
|-------|------|
| request_id | UUID |
| justification | texto |
| student_names | texto |
| estimated_amount_cents | inteiro |

### request_files

| Campo | Tipo |
|-------|------|
| id | UUID |
| request_id | UUID |
| file_type | enum |
| original_name | texto |
| storage_key | texto |
| mime_type | texto |
| size_bytes | inteiro |
| checksum | texto |
| uploaded_by | UUID |
| created_at | datetime |

### votes

| Campo | Tipo |
|-------|------|
| id | UUID |
| request_id | UUID |
| voter_id | UUID |
| vote_type | enum |
| comment | texto |
| created_at | datetime |
| updated_at | datetime |
| finalized_at | datetime |

Restrição:

```
UNIQUE(request_id, voter_id)
```

### deliberation_messages

| Campo | Tipo |
|-------|------|
| id | UUID |
| request_id | UUID |
| author_id | UUID |
| parent_message_id | UUID |
| content | texto |
| created_at | datetime |
| updated_at | datetime |
| deleted_at | datetime |

### view_requests

| Campo | Tipo |
|-------|------|
| id | UUID |
| request_id | UUID |
| requested_by | UUID |
| justification | texto |
| granted_at | datetime |
| deadline_before | datetime |
| deadline_after | datetime |
| created_at | datetime |

### financial_transactions

| Campo | Tipo |
|-------|------|
| id | UUID |
| request_id | UUID |
| type | enum |
| amount_cents | inteiro |
| from_state | enum |
| to_state | enum |
| performed_by | UUID |
| created_at | datetime |
| metadata | json |

### audit_events

| Campo | Tipo |
|-------|------|
| id | UUID |
| actor_id | UUID |
| action | texto |
| entity_type | texto |
| entity_id | UUID |
| before_data | json |
| after_data | json |
| ip_address | texto |
| user_agent | texto |
| created_at | datetime |