# Estudo de Caso - Deploy: Aplicação de Votação no Ecossistema AWS

### Desenvolvido por: [Rafael Henrique](https://github.com/rafaelhgreco) e [Mateus Stringuetti](https://github.com/Mstringacode)

Este documento detalha a arquitetura, configuração e processo de depuração para a implantação de uma aplicação de votação baseada em microserviços na Amazon Web Services (AWS) utilizando o Elastic Container Service (ECS) com Fargate.

---

## 1. Contexto

O objetivo do projeto foi migrar uma aplicação de votação que rodava localmente com `docker-compose` para um ambiente em nuvem gerenciado e escalável, enfrentando desafios como configuração de rede, segurança e gerenciamento de serviços.

A aplicação é composta por:

- **Frontend para votação (vote)**
- **Backend de resultados (result)**
- **Worker de processamento**
- **Serviços de apoio: Redis e PostgreSQL**

---

## 2. Visão Geral da Arquitetura

### Serviços Públicos (Frontend)

- **vote-service**: Interface web para votação.
- **result-service**: Interface web para exibição dos resultados.
- **Exposição via ALB (Application Load Balancer)** com health checks na rota `/`.


### Serviços Internos (Backend)

- **worker-service**: Processamento dos votos em background.
- **postgres-service**: Armazenamento relacional.
- **redis-service**: Fila em memória para votos temporários.

A comunicação entre os serviços se dá por meio de um **Network Load Balancer (NLB)** interno, que fornece pontos de acesso DNS estáveis.

---

## 3. Serviços AWS Utilizados

- **ECS (Elastic Container Service)**: Orquestração de contêineres.
- **Fargate**: Execução serverless das tarefas.
- **ECR (Elastic Container Registry)**: Armazenamento de imagens Docker.
- **IAM (LabRole)**: Permissões para ECS interagir com ECR, CloudWatch, ELB etc.
- **CloudWatch Logs**: Monitoramento e depuração com logs por serviço.
![Texto Alternativo](https://i.imgur.com/6ukHx3b.png)
---

### 3.1 Serviços de Balanceamento

- **Application Load Balancer (ALB)**
  - Porta 80
  - Target Groups: `vote-target-group`, `result-target-group`
  - Health check na rota `/`

- **Network Load Balancer (NLB) - Interno**
  - Porta 5432 para PostgreSQL
  - Porta 6379 para Redis

---

### 3.2 Segurança (Security Groups)

- **voting-app-alb-sg**: Permite HTTP (porta 80) de qualquer IP.
- **voting-app-tasks-sg**:
  - Porta 80: Acesso apenas do ALB
  - Porta 5432 e 6379: Comunicação interna entre tarefas

---

## 4. Dificuldades de Implementação e Soluções

| Problema                     | Sintoma                                      | Causa Raiz                                           | Solução                                                   |
|-----------------------------|----------------------------------------------|------------------------------------------------------|-----------------------------------------------------------|
| Descoberta de Serviço       | `Waiting for db`, `Name or service not known`| Nomes hard-coded (`db`, `redis`) sem DNS válido      | Criação de NLB com endpoints DNS internos                 |
| Código Hard-coded           | Conexões ainda falhando                      | Endereços fixos no código                            | Uso de variáveis de ambiente (`POSTGRES_HOST`, etc)      |
| Definição de Tarefa         | Configurações não aplicadas                  | Variáveis ausentes nas definições de tarefa          | Atualização das definições ECS com variáveis necessárias |
| Regras de Firewall/SG       | Timeout e falha nos health checks            | Regras mal configuradas                              | Ajuste completo dos SGs de entrada e saída                |
| Ciclo de Deploy             | Alterações sem efeito                        | Imagens antigas no ECR, tarefas não reiniciadas      | Rebuild com `--no-cache`, push e `Force new deployment`  |
| Bugs de Reconexão           | Worker não reconectava                       | Reconexão com host fixo                              | Uso das variáveis de ambiente para reconectar            |
| Falha em Health Check       | Result caía com erro 500                     | Rota `/` quebrava por erro no `sendFile`             | Substituição por `res.status(200).send("OK")` temporária |

---

## 5. Conclusão Final

A implantação bem-sucedida foi alcançada através de uma abordagem sistemática que envolveu ajustes em:

- Infraestrutura de rede (ALB/NLB)
- Segurança (Security Groups)
- Código-fonte (uso de variáveis de ambiente)
- Processo de deploy (build, push, atualização de tarefas)

A experiência reforça a importância de evitar configurações hard-coded e adotar um pipeline de implantação confiável e testável.

---

