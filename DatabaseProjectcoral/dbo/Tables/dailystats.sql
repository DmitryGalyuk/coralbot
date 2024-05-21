CREATE TABLE [dbo].[dailystats] (
    [gen]         INT            NOT NULL,
    [Id]          INT            NOT NULL,
    [Name]        NVARCHAR (255) NULL,
    [ParentId]    INT            NULL,
    [Rank]        NVARCHAR (10)  NULL,
    [Pending]     FLOAT (53)     NULL,
    [Personal]    FLOAT (53)     NULL,
    [Overall]     FLOAT (53)     NULL,
    [DateAdded]   DATE           NOT NULL,
    [GroupVolume] FLOAT (53)     NULL,
    PRIMARY KEY CLUSTERED ([DateAdded] DESC, [Id] ASC)
);


GO

