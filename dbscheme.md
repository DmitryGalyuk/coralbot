```mermaid
---
title: Coral Database
---
classDiagram
    Member <|-- Member
    Member <|-- MemberStats

    class Member{
        Id
        Name
        ParentId
    }

    class MemberStats{
        Id
        Date
        Rank
        PersonalVolume
        GroupVolume
        OverallVolume
        Pending
    }

    class ProcessedFiles{
        Filename
        Date
        Success
    }

```