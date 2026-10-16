FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY src/Yunost.Web/Yunost.Web.csproj src/Yunost.Web/
RUN dotnet restore src/Yunost.Web/Yunost.Web.csproj
COPY src/Yunost.Web/ src/Yunost.Web/
RUN dotnet publish src/Yunost.Web/Yunost.Web.csproj -c Release --no-restore -o /out /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
ENV ASPNETCORE_HTTP_PORTS=8080 \
    DataProtection__Path=/app/data/keys
COPY --from=build /out .
RUN mkdir -p /app/data/keys && chown -R $APP_UID:$APP_UID /app/data
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "Yunost.Web.dll"]
